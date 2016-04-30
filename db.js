"use strict";
const fs = require('fs');

let db = {};

class DB {
    constructor(){

    }

    read(field){
        if (field===undefined)
            return;
        return stats[field];
    }

    write(field, val){
        if (field===undefined || val===undefined)
            return;
        db[field] = val;
        return true;
    }

    remove(field){
        if (field===undefined)
            return;
        delete db[field];
        return true;
    }
}

module.exports = new DB();