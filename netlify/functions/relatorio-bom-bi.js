export async function handler() {

  try {

    const API_URL = process.env.SIGO_API_URL;
    const TOKEN = process.env.SIGO_TOKEN;

    console.log("API:", API_URL);

    const response = await fetch(
      `${API_URL}/relatorio-bom-bi`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/json"
        }
      }
    );

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };

  } catch (error) {

    return {
      statusCode: 500,
      body: JSON.stringify({
        erro: "Erro interno",
        detalhes: error.message
      })
    };

  }

}