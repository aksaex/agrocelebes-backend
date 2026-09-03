const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Menghitung kelayakan kredit petani berdasarkan Proposal Agro Celebes
 * Formula: (0.4 * NDVI_Satelit) + (0.4 * Kepatuhan_BMKG) + (0.2 * Reputasi_KUD)
 */
const hitungAgroScore = (ndviRiil = 0, skorBmkg = 0.8, skorKud = 0.9) => {
  // Pastikan NDVI berada di skala batas 0.0 - 1.0 agar perhitungan tidak bocor
  const normalizedNdvi = clamp(parseFloat(ndviRiil) || 0, 0, 1);
  
  // Konversi nilai ke skala 100 lalu kalikan dengan bobot proposal
  const nilaiSatelit = normalizedNdvi * 100 * 0.40;
  const nilaiBmkg = skorBmkg * 100 * 0.40;
  const nilaiKud = skorKud * 100 * 0.20;

  const totalScore = clamp(Math.round(nilaiSatelit + nilaiBmkg + nilaiKud), 0, 100);
  
  // Kategori kelayakan untuk BPD Sulselbar
  let kategori = 'Ditolak';
  if (totalScore >= 75) kategori = 'Layak Pendanaan Mandiri (Premium)';
  else if (totalScore >= 50) kategori = 'Layak (Penjaminan Kolektif KUD)';
  
  return {
    score: totalScore,
    kategori: kategori,
    breakdown: {
      ndvi: Math.round(nilaiSatelit),
      bmkg: Math.round(nilaiBmkg),
      kud: Math.round(nilaiKud)
    }
  };
};

module.exports = { hitungAgroScore };