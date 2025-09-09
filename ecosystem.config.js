module.exports = {
  apps: [
    {
      name: "chatbot",
      script: "chatbot.js",
      exec_mode: "fork",
      interpreter: "node",
      // Faz o Puppeteer rodar com um display virtual
      exec_interpreter: "xvfb-run",
      interpreter_args: "-a node",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
