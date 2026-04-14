const path = require("path");
const serverless = require("serverless-http");
const { pathToFileURL } = require("url");

let cachedHandler;

async function getHandler() {
  if (cachedHandler) return cachedHandler;

  const appModuleUrl = pathToFileURL(path.join(__dirname, "../../index.js")).href;
  const { app } = await import(appModuleUrl);
  cachedHandler = serverless(app);
  return cachedHandler;
}

module.exports.handler = async (event, context) => {
  const handler = await getHandler();

  if (event.isBase64Encoded && event.body) {
    event.body = Buffer.from(event.body, "base64").toString("utf-8");
    event.isBase64Encoded = false;
  }

  return handler(event, context);
};
