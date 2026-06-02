module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.status(410).json({
    error: "Endpoint desativado. A recuperacao de senha agora usa Supabase Auth nativo no frontend.",
  });
};
