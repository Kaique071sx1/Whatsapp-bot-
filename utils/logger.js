const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const logStream = fs.createWriteStream(path.join(__dirname, '..', 'logs.txt'), { flags: 'a' });

function log(level, message, ...args) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Log to console with colors
    let chalkedMessage = formattedMessage;
    if (level === 'info') chalkedMessage = chalk.blue(formattedMessage);
    if (level === 'warn') chalkedMessage = chalk.yellow(formattedMessage);
    if (level === 'error') chalkedMessage = chalk.red(formattedMessage);
    
    console.log(chalkedMessage, ...args);

    // Log to file
    const fileMessage = `${formattedMessage} ${args.map(arg => JSON.stringify(arg)).join(' ')}\n`;
    logStream.write(fileMessage);
}

module.exports = {
    info: (message, ...args) => log('info', message, ...args),
    warn: (message, ...args) => log('warn', message, ...args),
    error: (message, ...args) => log('error', message, ...args),
};
