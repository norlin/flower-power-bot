"use strict";
const request = require('request');
const co = require('co');
const FlowerPowerApi = require('flower-power-api');
const DB = require('./db');
const config = require('./config.json');

let users = {};

function parseId(bot, message){
    if (!message.from || !message.from.username){
        bot.response(message, "BUG: Can't find your username");
        return;
    }

    return message.from.username;
}

function getUser(bot, message){
    return co(function*(){
        const username = parseId(bot, message);
        if (!username){
            return;
        }

        if (users[username]){
            return users[username];
        }

        let user = yield DB().getUser(username);

        if (!user){
            user = yield DB().saveUser(username, {garden:{}});
        }
        users[username] = user;
        if (!user.garden){
            user.garden = {};
        }

        if (user.token){
            let api = new FlowerPowerApi();
            api.autoRefresh = true;
            yield new Promise((resolve, reject)=>{
                api.setToken(user.token, resolve);
            });
            users[username].api = api;
        }

        return users[username];
    }).catch(e=>{
        console.log('commands/getUser', e, message);
        bot.response(message, 'Something is going wrong, sorry.');
    });
}

function saveUser(bot, message){
    return co(function*(){
        let user = yield getUser(bot, message);

        let data = {
            telegram_id: user.telegram_id,
            token: user.token||null,
            garden: user.garden||{},
        };

        yield DB().saveUser(user.telegram_id, data);
    }).catch(e=>{
        console.log('commands/saveUser', e, message);
    });
}

const Commands = {
    '404': {
        hidden: true,
        desc: 'Command not found',
        func: function(message){
            const bot = this;
            co(function*(){
                yield bot.response(message, "I don't understand you... :(");
                return bot.execute('help', message);
            });
        }
    },
    'shutdown': {
        hidden: true,
        func: function(message){
            setTimeout(function(){
                process.exit(2);
            }, 1000);
            this.response(message, 'Done, bye!', function(){
                process.exit(2);
            });
        }
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
    'start': {alias: 'help'},
    'login': {
        desc: 'Register your Flower Power account with bot: `/login username password`',
        func: function(message){
            const bot = this;
            co(function*(){
                let user = yield getUser(bot, message);

                if (!user){
                    return;
                }

                if (user.api){
                    bot.response(message, 'Your Flower Power is already registered. Please /remove it first.');
                    return;
                }

                const credentialsNotFound = 'Please enter email and password separated with space character:\n/login username password';

                let data = message.text.split(/\s+/);
                if (!data || data.length != 2){
                    bot.response(message, credentialsNotFound);
                    return;
                }

                const email = data[0];
                const password = data[1];

                if (!email || !password){
                    bot.response(message, credentialsNotFound);
                    return;
                }

                const api = new FlowerPowerApi();

                const credentials = {
                    'username': email,
                    'password': password,
                    'client_id': config.fp_client,
                    'client_secret': config.fp_secret,
                    'auto-refresh': true,
                };

                let token;
                try {
                    token = yield new Promise((resolve, reject)=>{
                        api.login(credentials, (err, token)=>{
                            if (err){
                                return reject(err);
                            }

                            resolve(token);
                        });
                    });
                } catch(err){
                    bot.response(message, 'There is an error:\n'+err);
                    return;
                }

                user.api = api;
                user.token = token;

                yield saveUser(bot, message);

                bot.response(message, 'Hooray!\n Now you can check your plants with /info command.');
            }).catch(e=>{
                console.log('commands/login', e);
            });
        },
    },
    'remove': {
        desc: 'Unregister your account',
        func: function(message){
            const bot = this;
            co(function*(){
                let user = yield getUser(bot, message);

                if (!user){
                    return;
                }

                if (!user.api && !user.token){
                    bot.response(message, 'Your Flower Power is not registered.');
                    return;
                }
                delete user.api;
                delete user.token;
                delete user.garden;

                yield saveUser(bot, message);

                delete users[user.telegram_id];
                bot.response(message, 'Your Flower Power has been successfully removed.');
            }).catch(e=>{
                console.log('commands/remove', e);
            });
        },
    },
    'stop': {alias: 'remove'},
    'info': {
        desc: 'Show the plant info: `/info plant-name` or `/info all`',
        func: function(message){
            const bot = this;

            function sendPlantInfo(plant){
                bot.response(message, `${plant.plant_nickname}: updated ${plant.last_upload_datetime_utc}`);
            }

            co(function*(){
                const user = yield getUser(bot, message);

                if (!user){
                    return;
                }

                const api = user.api;
                if (!api){
                    bot.response(message, 'Please /login first.');
                    return;
                }

                let plant_name = message.text;
                if (!plant_name){
                    bot.response(message, 'Please specify which plant do you want to check? `/info your-plant-name`\nOr use `/info all` to check all plants.');
                    return;
                }

                if (plant_name=='all'){
                    plant_name = undefined;
                }

                const data = yield new Promise((resolve, reject)=>{
                    api.getGarden((err, data)=>{
                        if (err){
                            return reject(err);
                        }

                        resolve(data);
                    });
                });

                const sensors = data.sensors;
                let found = false;

                for (let sensor in sensors){
                    const plant = sensors[sensor];

                    if (plant_name && plant.plant_nickname != plant_name)
                        continue;

                    found = plant.location_identifier;

                    const image = plant.images && plant.images[0] && plant.images[0].url;

                    user.garden[sensor] = {
                        plant_nickname: plant.plant_nickname
                    };

                    if (image){
                        let res;
                        try {
                            res = yield new Promise((resolve, reject)=>{
                                request.head(image, (err, res)=>{
                                    if (err){
                                        return reject(err);
                                    }

                                    resolve(res);
                                });
                            });
                        } catch(e){}

                        if (!res){
                            return sendPlantInfo(plant);
                        }

                        const type = res.headers['content-type'];

                        try {
                            yield bot.sendPhoto(message, {
                                contntType: type,
                                stream: request(image),
                                filename: 'plant.jpg',
                            });
                        } catch(e){}
                    }
                    sendPlantInfo(plant);
                }
                if (!found){
                    if (plant_name){
                        bot.response(message, `Plant with name ${plant_name} is not found in your garden!`);
                        return;
                    }
                    bot.response(message, 'There is no plants found in your garden!');
                    return;
                }

                return;

                if (!plant_name){
                    return;
                }

                const stats = yield new Promise((resolve, reject)=>{
                    api.getStatistics({
                        url: {location_identifier: found},
                        from_datetime_utc: (new Date()).toISOString(),
                        include_acknowledged: true,
                    }, (err, data)=>{
                        if (err){
                            return reject(err);
                        }

                        resolve(data);
                    });
                });

                console.log(stats);
            }).catch(e=>{
                console.log('commands/info', e);
                bot.response(message, 'Something is going wrong, sorry.');
            });
        },
    }
};

module.exports = Commands;