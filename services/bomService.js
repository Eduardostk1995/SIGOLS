export async function carregarBOM() {

  const response = await fetch(
    "/.netlify/functions/relatorio-bom-bi"
  );

  const resultado = await response.json();

  return resultado.data || [];

}