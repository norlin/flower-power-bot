"use strict"
const Bot = require('node-telegram-bot');
const config = require('./config.json');
const Stats = require('./stat');
const Commands = require('./commands');

const DB = require('./db');

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
        if (Commands[command].hidden && message.from.id!=config.author_id){
            command = '404';
        }
        if (Commands[command].alias && Commands[command].alias!=command){
            return this.execute(Commands[command].alias, message);
        }
        let text = message.text.split(/\s+/);
        text.splice(0, 1);
        message.text = text.join(' ');
        Commands[command].func.call(this, message);
    }

    getOptions(message){
        let options = {
            chat_id: message.chat.id,
            parse_mode: 'Markdown',
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

    response(message, text){
        let options = this.getOptions(message);
        options.text = text;

        return new Promise((resolve, reject)=>{
            this.bot.sendMessage(options, (err, res)=>{
                if (err){
                    return reject(err);
                }

                resolve(res);
            });
        });
    }

    sendPhoto(message, data){
        let options = this.getOptions(message);
        options.files = data;

        return new Promise((resolve, reject)=>{
            this.bot.sendPhoto(options, (err, res)=>{
                if (err){
                    return reject(err);
                }

                resolve(res);
            });
        });
    }

    sendMessage(chat_id, text){
        return new Promise((resolve, reject)=>{
            this.bot.sendMessage({chat_id: chat_id, text: text}, (err, res)=>{
                if (err){
                    return reject(err);
                }

                resolve(res);
            });
        });
    }
}

const bot = new Bot({
    token: config.token
});
const handler = new Handler(bot);

DB(handler);
console.log('Running...');
