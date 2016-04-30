"use strict";
const co = require('co');
const mongodb = require('mongodb');
const config = require('./config.json');
const url = 'mongodb://localhost:27017/flower-power';

class DB {
    constructor(bot){
        const _this = this;
        this.bot = bot;

        this.queue = [];
        co(function*(){
            try {
                yield _this.connect();
            } catch(e){
                _this.error(e);
                return;
            }

            _this.ready = true;
        });
    }

    connect(){
        const _this = this;
        return co(function*(){
            let db = yield mongodb.connect(url);

            let users;
            try {
                users = yield db.collection('users');
            } catch(e){}

            if (users){
                return;
            }

            _this.users = yield db.createCollection('users');
        });
    }

    error(msg){
        console.log(msg);
        return;
        this.bot.sendMessage(config.author_id, `Error:\n${msg}`, function(err){
            if (err){
                console.log(err);
                process.exit(1);
            }
        });
    }

    getUser(id){
        const _this = this;
        return co(function*(){
            if (!_this.users){
                throw new Error('No this.users found!');
            }

            let user;
            try {
                user = yield _this.users.findOne({telegram_id: id});
            } catch(e){
                console.log('db/getUser 1', e);
            }

            return user;
        }).catch(e=>{
            console.log('db/getUser 22', e);
        });
    }

    saveUser(id, data, cb){
        const _this = this;
        const query = {telegram_id: id};
        return co(function*(){
            if (!_this.users){
                throw new Error('No this.users found!');
            }

            let user;

            try {
                user = yield _this.users.findOne(query);
            } catch(e){}

            if (!user){
                data.telegram_id = id;
                user = yield _this.users.insertOne(data);
                return user;
            }

            Object.assign(user, data);
            yield _this.users.updateOne(query, user);
        }).catch(e=>{
            console.log('db/saveUser', e);
        });
    }
}

let db_instance;
module.exports = function(bot){
    if (db_instance){
        return db_instance;
    }

    if (!bot){
        throw new Error('DB: No bot found!');
        return;
    }

    db_instance = new DB(bot);

    return db_instance;
};