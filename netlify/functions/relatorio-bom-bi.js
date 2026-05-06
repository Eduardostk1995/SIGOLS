export async function handler() {
  try {

    const response = await fetch(
      `${process.env.SIGO_API_URL}/relatorio-bom-bi`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SIGO_TOKEN}`,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          erro: "Erro ao consultar API do SIGO",
          status: response.status
        })
      };
    }

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