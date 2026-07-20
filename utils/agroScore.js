const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hitungAgroScore = ({ luasLahanHa = 0, cuacaScore = 1, riwayatJurnalScore = 1 }) => {
  const sanitizedLuas = Number.isFinite(Number(luasLahanHa)) ? Number(luasLahanHa) : 0;
  const sanitizedCuaca = Number.isFinite(Number(cuacaScore)) ? Number(cuacaScore) : 1;
  const sanitizedJurnal = Number.isFinite(Number(riwayatJurnalScore)) ? Number(riwayatJurnalScore) : 1;

  const nilaiMentah = sanitizedLuas * sanitizedCuaca * sanitizedJurnal * 10;
  return clamp(Math.round(nilaiMentah), 0, 100);
};

module.exports = { hitungAgroScore };

