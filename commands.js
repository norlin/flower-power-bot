"use strict";
const request = require('request');
const FlowerPowerApi = require('flower-power-api');
const DB = require('./db');
const config = require('./config.json');

let users = {};

function getUser(message){
    if (!message.from || !message.from.username){
        this.response(message, "BUG: Can't find your username");
        return;
    }
    const username = message.from.username;
    if (!users[username]){
        users[username] = {username: username, garden: {}};
    }
    return users[username];
}

function errorHandler(message, cb){
    return (err, data)=>{
        if (err){
            this.response(message, 'There is an error:\n'+err);
            return;
        }
        cb.apply(this, [data]);
    }
}

const Commands = {
    '404': {
        hidden: true,
        desc: 'Command not found',
        func: function(message){
            this.response(message, "I don't understand you... :(", ()=>this.execute('help', message));
        }
    },
    'помощь': {
        alias: 'help'
    },
    'help': {
        desc: 'Show this message',
        func: function(message){
            let text = [
                'Here is a possible commands list:'
            ];
            for (let cmd in Commands){
                if (Commands.hasOwnProperty(cmd) && !this.isHidden(cmd)){
                    text.push('  /'+cmd+': '+Commands[cmd].desc);
                }
            }
            text.push('Thanks!');

            this.response(message, text.join('\n'));
        }
    },
    'start': {
        alias: 'help'
    },
    'login': {
        desc: 'Register your Flower Power account with bot: `/login username password`',
        func: function(message){
            let user = getUser.call(this, message);
            if (!user){
                return;
            }
            if (user.api){
                this.response(message, 'Your Flower Power is already registered. Please /remove it first.');
                return;
            }
            const credentialsNotFound = 'Please enter email and password separated with space character:\n/login username password';
            let data = message.text.split(/\s+/);
            if (!data || data.length != 2){
                this.response(message, credentialsNotFound);
                return;
            }
            const email = data[0];
            const password = data[1];
            if (!email || !password){
                this.response(message, credentialsNotFound);
                return;
            }
            const api = new FlowerPowerApi();
            const credentials = {
                'username': email,
                'password': password,
                'client_id': config.fp_client,
                'client_secret': config.fp_secret,
                'auto-refresh': false
            };
            api.login(credentials, errorHandler(message, (data)=>{
                user.api = api;
                this.response(message, 'Hooray!');
            }));
        },
    },
    'remove': {
        desc: 'Unregister your account',
        func: function(message){
            let user = getUser.call(this, message);
            if (!user){
                return;
            }
            if (!user.api){
                this.response(message, 'Your Flower Power is not registered.');
                return;
            }
            delete user.api;
            delete users[user.username];
            this.response(message, 'Your Flower Power has been successfully removed.');
        },
    },
    'info': {
        desc: 'Show the plant info: `/info plant-name` or `/info all`',
        func: function(message){
            const bot = this;
            const user = getUser.call(this, message);
            if (!user){
                return;
            }

            const api = user.api;
            if (!api){
                this.response(message, 'Please /login first.');
                return;
            }

            function sendPlantInfo(plant){
                bot.response(message, `${plant.plant_nickname}: updated ${plant.last_upload_datetime_utc}`);
            }

            let plant_name = message.text;
            if (!plant_name){
                this.response(message, 'Please specify which plant do you want to check? `/info your-plant-name`\nOr use `/info all` to check all plants.');
                return;
            }

            if (plant_name=='all'){
                plant_name = undefined;
            }

            api.getGarden(errorHandler(message, (data)=>{
                const sensors = data.sensors;
                let found = false;
                for (let sensor in sensors){
                    const plant = sensors[sensor];
                    if (plant_name && plant.plant_nickname != plant_name)
                        continue;
                    found = true;
                    const image = plant.images && plant.images[0] && plant.images[0].url;
                    user.garden[sensor] = {
                        plant_nickname: plant.plant_nickname
                    };
                    if (image){
                        request.head(image, (err, res)=>{
                            if (err){
                                sendPlantInfo(plant);
                                return;
                            }
                            const type = res.headers['content-type'];
                            this.sendPhoto(message, {
                                contntType: type,
                                stream: request(image),
                                filename: 'plant.jpg',
                            }, function(err, res){
                                sendPlantInfo(plant);
                            });
                        });
                    } else {
                        sendPlantInfo(plant);
                    }
                }
                if (!found){
                    if (plant_name){
                        this.response(message, `Plant with name ${plant_name} is not found in your garden!`);
                        return;
                    }
                    this.response(message, 'There is no plants found in your garden!');
                }
            }));
        },
    }
};

module.exports = Commands;