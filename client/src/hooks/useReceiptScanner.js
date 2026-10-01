import { useState } from 'react';
import api from '../api/axios';

export function useReceiptScanner() {
  const [scanning,  setScanning]  = useState(false);
  const [preview,   setPreview]   = useState(null);
  const [scanError, setScanError] = useState(null);

  const scanReceipt = async (file, setFormData) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setScanning(true);
    setScanError(null);

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const { data } = await api.post('/receipt/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (data.success) {
        setFormData(prev => ({
          ...prev,
          amount:      data.data.amount      ?? prev.amount,
          category:    data.data.category    ?? prev.category,
          description: data.data.description ?? prev.description,
        }));
      }
    } catch (err) {
      setScanError('Scan failed — fill in manually');
    } finally {
      setScanning(false);
    }
  };

  return { scanning, preview, scanError, scanReceipt };
}