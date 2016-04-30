"use strict"
const Bot = require('node-telegram-bot');
const config = require('./config.json');
const Stats = require('./stat');
const Commands = require('./commands');

class Handler {
    constructor(bot){
        this.bot = bot;
        this.parse = this.parse.bind(this);
        this.bot.on('message', this.parse);
        this.bot.start();
    }

    parse(message){
        const text = message.text;
        let command = text.match(/^\/(.*)$/);
        command = command && command[1] || text || '';
        command = command.split(/\s/);
        command = command && command[0] || command || '';
        this.stat(message);
        this.execute(command.toLowerCase(), message);
    }

    stat(message){
        Stats.add('total');
        return;
    }

    execute(command, message){
        if (!command||!Commands[command]){
            command = '404';
        }
        if (Commands[command].alias && Commands[command].alias!=command)
            return this.execute(Commands[command].alias, message);
        let text = message.text.split(/\s+/);
        text.splice(0, 1);
        message.text = text.join(' ');
        Commands[command].func.call(this, message);
    }

    getOptions(message){
        let options = {
            chat_id: message.chat.id,
            //reply_to_message_id: message.message_id
        };

        return options;
    }

    isHidden(cmd){
        cmd = Commands[cmd];
        if (cmd){
            return cmd.hidden || !!cmd.alias;
        }
        return true;
    }

    response(message, text, cb){
        let options = this.getOptions(message);
        options.text = text;
        this.bot.sendMessage(options, cb);
    }

    sendPhoto(message, data, cb){
        let options = this.getOptions(message);
        options.files = data;
        this.bot.sendPhoto(options, cb);
    }
}

const bot = new Bot({
    token: config.token
});
const handler = new Handler(bot);
console.log('Running...');