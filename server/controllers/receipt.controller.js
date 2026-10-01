require('dotenv').config();

const fs = require('fs/promises');
const axios = require('axios');
const { GoogleGenAI, Type } = require('@google/genai');

console.log(
  'Gemini API Key present:',
  !!process.env.GEMINI_API_KEY
);

// ============================================================
// GEMINI CLIENT
// ============================================================

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    })
  : null;

// ============================================================
// CONSTANTS
// ============================================================

const VALID_CATEGORIES = [
  'Travel',
  'Meals',
  'Software',
  'Office',
  'Other'
];

// IMPORTANT:
// Make sure this model name is available for your Gemini API account.
// If your API returns "model not found", replace this with a model
// available to your project.
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-3.5-flash';


// ============================================================
// HELPER - GET IMAGE AS BASE64
// ============================================================

async function getImageAsBase64(file) {
  if (!file) {
    throw new Error('No file provided');
  }

  /*
   * If Multer/Cloudinary/etc. gives us a URL,
   * download the image using Axios.
   */
  if (
    typeof file.path === 'string' &&
    /^https?:\/\//i.test(file.path)
  ) {
    const response = await axios.get(file.path, {
      responseType: 'arraybuffer'
    });

    return Buffer
      .from(response.data)
      .toString('base64');
  }

  /*
   * If the file is stored locally,
   * read it directly from disk.
   */
  if (file.path) {
    const imageBuffer = await fs.readFile(file.path);

    return imageBuffer.toString('base64');
  }

  /*
   * Some Multer configurations provide the file
   * directly through file.buffer.
   */
  if (file.buffer) {
    return Buffer
      .from(file.buffer)
      .toString('base64');
  }

  throw new Error('Unable to read uploaded image');
}


// ============================================================
// SCAN RECEIPT
// ============================================================

exports.scanReceipt = async (req, res) => {
  try {

    // --------------------------------------------------------
    // CHECK FILE
    // --------------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        error: 'No receipt image uploaded'
      });
    }


    // --------------------------------------------------------
    // FILE INFORMATION
    // --------------------------------------------------------

    console.log(
      'File received:',
      req.file.originalname || 'unknown',
      req.file.mimetype || 'unknown'
    );

    console.log(
      'Gemini available:',
      !!ai
    );


    // --------------------------------------------------------
    // MOCK FALLBACK
    // --------------------------------------------------------

    if (!ai) {

      console.log(
        'Using MOCK — GEMINI_API_KEY not configured'
      );

      return res.json({
        success: true,
        mock: true,

        data: {
          amount: 1250.00,
          vendor: 'Mock Restaurant',
          category: 'Meals',

          date: new Date()
            .toISOString()
            .split('T')[0],

          description:
            'Restaurant meal expense'
        }
      });
    }


    // --------------------------------------------------------
    // IMAGE DATA
    // --------------------------------------------------------

    const base64 = await getImageAsBase64(
      req.file
    );

    const mimeType =
      req.file.mimetype || 'image/jpeg';


    // --------------------------------------------------------
    // GEMINI MODEL
    // --------------------------------------------------------

    const model = GEMINI_MODEL;

    console.log(
      'Calling Gemini model:',
      model
    );


    // --------------------------------------------------------
    // PROMPT
    // --------------------------------------------------------

    const prompt = `
You are an expense receipt scanner.

Analyze the provided receipt image carefully.

Extract the following information:

1. amount
   - Extract the GRAND TOTAL / FINAL AMOUNT PAID.
   - Return only the numeric value.
   - Do not return currency symbols.

2. vendor
   - Extract the restaurant, store, company,
     or business name.

3. category
   - Must be exactly one of:
     Travel
     Meals
     Software
     Office
     Other

   Rules:
   - Restaurant or food bill = Meals
   - Flight, taxi, train, bus, hotel = Travel
   - Software or subscription = Software
   - Stationery or office supplies = Office
   - Anything else = Other

4. date
   - Extract the receipt date.
   - Format must be YYYY-MM-DD.

5. description
   - Give a short description of what was purchased.

IMPORTANT:
- Do not guess unnecessarily.
- Read the total carefully.
- Return structured data only.
`;


    // --------------------------------------------------------
    // GEMINI REQUEST
    // --------------------------------------------------------

    const response =
      await ai.models.generateContent({

        model,

        contents: [
          {
            role: 'user',

            parts: [

              {
                inlineData: {
                  mimeType,

                  // FIX:
                  // Previously this was "base64Image",
                  // but the variable actually defined above
                  // is "base64".
                  data: base64
                }
              },

              {
                text: prompt
              }

            ]
          }
        ],

        config: {

          responseMimeType:
            'application/json',

          responseSchema: {

            type: Type.OBJECT,

            properties: {

              amount: {
                type: Type.NUMBER
              },

              vendor: {
                type: Type.STRING
              },

              category: {
                type: Type.STRING,

                enum:
                  VALID_CATEGORIES
              },

              date: {
                type: Type.STRING
              },

              description: {
                type: Type.STRING
              }

            },

            required: [
              'amount',
              'vendor',
              'category',
              'date',
              'description'
            ]

          }

        }

      });


    // --------------------------------------------------------
    // READ GEMINI RESPONSE
    // --------------------------------------------------------

    const raw =
      typeof response.text === 'function'
        ? response.text()
        : response.text;

    console.log(
      'Gemini response:',
      raw
    );


    // --------------------------------------------------------
    // EMPTY RESPONSE
    // --------------------------------------------------------

    if (!raw) {

      return res.status(422).json({
        error:
          'Gemini returned an empty response'
      });

    }


    // --------------------------------------------------------
    // PARSE JSON
    // --------------------------------------------------------

    let parsed;

    try {

      parsed =
        typeof raw === 'string'
          ? JSON.parse(raw)
          : raw;

    } catch (err) {

      console.error(
        'JSON parsing failed:',
        raw
      );

      return res.status(422).json({

        error:
          'Could not read receipt — please fill in manually',

        raw

      });

    }


    // --------------------------------------------------------
    // VALIDATE / SANITIZE AMOUNT
    // --------------------------------------------------------

    const amount =
      typeof parsed.amount === 'number'
        ? parsed.amount
        : parseFloat(parsed.amount);


    // --------------------------------------------------------
    // VALIDATE / SANITIZE RESULT
    // --------------------------------------------------------

    const resultData = {

      amount:
        Number.isFinite(amount)
          ? amount
          : null,

      vendor:
        typeof parsed.vendor === 'string'
          ? parsed.vendor.trim()
          : null,

      category:
        VALID_CATEGORIES.includes(
          parsed.category
        )
          ? parsed.category
          : 'Other',

      date:
        parsed.date &&
        /^\d{4}-\d{2}-\d{2}$/.test(
          parsed.date
        )
          ? parsed.date
          : new Date()
              .toISOString()
              .split('T')[0],

      description:
        typeof parsed.description === 'string'
          ? parsed.description.trim()
          : null

    };


    // --------------------------------------------------------
    // LOG EXTRACTED DATA
    // --------------------------------------------------------

    console.log(
      'Extracted data:',
      resultData
    );


    // --------------------------------------------------------
    // SEND TO FRONTEND
    // --------------------------------------------------------

    return res.json({

      success: true,

      mock: false,

      data: resultData

    });


  } catch (err) {

    console.error(
      'Receipt scan error:',
      err.message
    );

    console.error(err);


    return res.status(500).json({

      error:
        'Receipt scanning failed',

      details:
        err.message

    });

  }
};


// ============================================================
// SUGGEST CATEGORY
// ============================================================

exports.suggestCategory = async (req, res) => {

  try {

    // --------------------------------------------------------
    // GET REQUEST DATA
    // --------------------------------------------------------

    const {
      description,
      vendor
    } = req.body;


    // --------------------------------------------------------
    // MOCK FALLBACK
    // --------------------------------------------------------

    if (!ai) {

      return res.json({

        category: 'Other',

        confidence: 'low',

        reason:
          'AI not configured'

      });

    }


    // --------------------------------------------------------
    // GEMINI REQUEST
    // --------------------------------------------------------

    const response =
      await ai.models.generateContent({

        model: GEMINI_MODEL,

        contents: `

Expense categorization task.

Description:
${description || ''}

Vendor:
${vendor || ''}

Choose exactly one category:

Travel
Meals
Software
Office
Other

Return JSON containing:

category
confidence
reason

Confidence must be:
high
medium
low

`,

        config: {

          responseMimeType:
            'application/json',

          responseSchema: {

            type: Type.OBJECT,

            properties: {

              category: {

                type: Type.STRING,

                enum:
                  VALID_CATEGORIES

              },

              confidence: {

                type: Type.STRING,

                enum: [
                  'high',
                  'medium',
                  'low'
                ]

              },

              reason: {

                type: Type.STRING

              }

            },

            required: [
              'category',
              'confidence',
              'reason'
            ]

          }

        }

      });


    // --------------------------------------------------------
    // PARSE RESPONSE
    // --------------------------------------------------------

    const raw =
      typeof response.text === 'function'
        ? response.text()
        : response.text;

    const parsed =
      typeof raw === 'string'
        ? JSON.parse(raw)
        : raw;


    // --------------------------------------------------------
    // RETURN RESULT
    // --------------------------------------------------------

    return res.json({

      category:
        VALID_CATEGORIES.includes(
          parsed.category
        )
          ? parsed.category
          : 'Other',

      confidence:
        ['high', 'medium', 'low'].includes(
          parsed.confidence
        )
          ? parsed.confidence
          : 'medium',

      reason:
        typeof parsed.reason === 'string'
          ? parsed.reason
          : ''

    });


  } catch (err) {

    console.error(
      'Category suggestion error:',
      err.message
    );


    return res.json({

      category: 'Other',

      confidence: 'low',

      reason:
        'Suggestion unavailable'

    });

  }

};


// ============================================================
// ANOMALY DETECTION
// ============================================================

exports.analyzeExpenses = async (req, res) => {

  try {

    // --------------------------------------------------------
    // DATABASE
    // --------------------------------------------------------

    const {
      sequelize
    } = require('../models/index');

    const {
      QueryTypes
    } = require('sequelize');


    // --------------------------------------------------------
    // GET RECENT APPROVED EXPENSES
    // --------------------------------------------------------

    const expenses =
      await sequelize.query(

        `
        SELECT
          e.id,
          e.amount,
          e.category,
          e.description,
          u.name AS employee,
          e.created_at

        FROM expenses e

        JOIN users u
          ON u.id = e.user_id

        WHERE e.status = 'Approved'

        AND e.created_at >=
          DATE_SUB(
            NOW(),
            INTERVAL 30 DAY
          )

        ORDER BY e.amount DESC

        LIMIT 50
        `,

        {
          type:
            QueryTypes.SELECT
        }

      );


    // --------------------------------------------------------
    // NO AI / NO DATA
    // --------------------------------------------------------

    if (
      !ai ||
      expenses.length === 0
    ) {

      return res.json({

        anomalies: [],

        summary:
          'No data to analyze',

        total_analyzed:
          expenses.length

      });

    }


    // --------------------------------------------------------
    // GEMINI ANOMALY ANALYSIS
    // --------------------------------------------------------

    const response =
      await ai.models.generateContent({

        model:
          GEMINI_MODEL,

        contents: `

Analyze these company expenses for anomalies
or possible fraud.

Expenses:

${JSON.stringify(
  expenses,
  null,
  2
)}

Look for:

- unusually high expenses
- suspicious patterns
- duplicate-like expenses
- unusual categories
- unusual employee spending
- possible fraud

Severity must be:

high
medium
low

Return JSON only.

`,

        config: {

          responseMimeType:
            'application/json',

          responseSchema: {

            type: Type.OBJECT,

            properties: {

              anomalies: {

                type: Type.ARRAY,

                items: {

                  type: Type.OBJECT,

                  properties: {

                    expense_id: {

                      type:
                        Type.NUMBER

                    },

                    severity: {

                      type:
                        Type.STRING,

                      enum: [
                        'high',
                        'medium',
                        'low'
                      ]

                    },

                    reason: {

                      type:
                        Type.STRING

                    },

                    recommendation: {

                      type:
                        Type.STRING

                    }

                  },

                  required: [

                    'expense_id',

                    'severity',

                    'reason',

                    'recommendation'

                  ]

                }

              },

              summary: {

                type:
                  Type.STRING

              },

              total_analyzed: {

                type:
                  Type.NUMBER

              }

            },

            required: [

              'anomalies',

              'summary',

              'total_analyzed'

            ]

          }

        }

      });


    // --------------------------------------------------------
    // PARSE GEMINI RESPONSE
    // --------------------------------------------------------

    const raw =
      typeof response.text === 'function'
        ? response.text()
        : response.text;

    const parsed =
      typeof raw === 'string'
        ? JSON.parse(raw)
        : raw;


    // --------------------------------------------------------
    // RETURN RESULT
    // --------------------------------------------------------

    return res.json({

      anomalies:
        Array.isArray(parsed.anomalies)
          ? parsed.anomalies
          : [],

      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : 'Analysis completed',

      total_analyzed:
        Number.isFinite(
          parsed.total_analyzed
        )
          ? parsed.total_analyzed
          : expenses.length

    });


  } catch (err) {

    console.error(
      'Anomaly detection error:',
      err.message
    );

    console.error(err);


    return res.status(500).json({

      error:
        'Analysis failed',

      details:
        err.message

    });

  }

};