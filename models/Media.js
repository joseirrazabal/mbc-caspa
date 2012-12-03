var Media, server = false;
if (typeof exports !== 'undefined') {
    BackboneIO = require(__dirname + '/Default');
    _ = require('underscore');
    Media = exports.Media = {};
    server = true;
} else {
    Media = root.Media = {};
}

var leadingZero = function (num) {
    return (num < 10) ? "0"+num : num;
}

var toMilliseconds = function (time) {
    var t = time.match(/(\d{2}):(\d{2}):(\d{2})\.(\d*)/);
    t.shift();
    d = moment.duration ({
        hours:        t[0],
        minutes:      t[1],
        seconds:      t[2],
        milliseconds: t[3]*10
    });

    return d.asMilliseconds();
};

var prettyTime =  function (m) {
    d = moment.duration(m);
    var p = leadingZero(d.hours())   + ':'
        + leadingZero(d.minutes()) + ':'
        + leadingZero(d.seconds()) + '.'
        + leadingZero(d.milliseconds()/10);
    return p;
};

var arrayDuration = function (a) {
    return  _.reduce(a, function (m, n) {
        return m + toMilliseconds (n);}, 0);
};

Media.Model = BackboneIO.Model.extend({
    urlRoot: "media",
    idAttribute: "_id",
    validate: function (attrs) {
        console.log ("checking", attrs);
        if (attrs.file && ! attrs.file.length) {
            console.log ('NO file');
            return new Error("file must be defined");
        }
        if (attrs.stat       &&
            (! attrs.stat.mtime ||
             ! attrs.stat.size  ||
             attrs.stat.size <= 4000)) {
            console.log ('NO or BAD stat');
            return new Error("stat must be defined");
        }
    },
    defaults: {
        _id: null,
        file: "None",
        name: "",
        audio: "None",
        video: "None",
        template: 'mediaview',
    }
});

/* all methods are overriden in Default.js */
Media.Collection = BackboneIO.Collection.extend({
    model: Media.Model,
    url: 'media',
    add: function (models, opts) {
        var self = this;
        console.log ('hacked add', this, models, opts);

        if (!opts)
            opts = {};

        var index = (opts.at) ? opts.at : this.size();
        opts.at = index;

        if (! (models instanceof Array))
            models = [models]

        models.forEach (function (e, i) {
            self.set_index (e, index + i);
            console.log ('aaadododd', e, opts);
        });

        return BackboneIO.Collection.prototype.add.call (this, models.reverse(), opts);
    },
    create: function (model, opts) {
        var index = (opts && opts.at) ? opts.at : this.size();
        this.set_index (model, index);
        return Backbone.Collection.prototype.create.call (this, model, opts);
    },
});


Media.Piece = Media.Model.extend ({
    urlRoot: 'piece',
    defaults: {
        trim: {
            timein:  0,
            timeout: 0,
        },
        overlay: [],
    },
});

Media.Block = Media.Collection.extend ({
    model: Media.Piece,
    url: 'piece',
    set_index: function (model, index) {
        console.log ('BLOCK set_index');
        console.trace();
        var id = this._get_id(model);
        this._set_id (model, id.split('-')[0] + '-' + index);

        return Media.Collection.prototype.set_index.call (this, model, index);
    },
});

Media.List = Media.Model.extend ({
    urlRoot: 'list',
    initialize: function () {
        var models = this.get('models')
        var col    = this.get('collection')
        console.log ("initing media list", models, col);
        if (!col || col instanceof Array) {
            col = new Media.Block(models, {connectable: true});
            console.log ('col is array ! recreating as collection', col);
        }

        var self = this;
        col.wrapper = this;

        col.bind('all', function (a, b) {
            console.log ('got a change in the force', a, b);
            var models = self.get('collection').models;
            self.set({models: models});
            self.updateMD5(models);
            console.log ('-----got a change in the force', a, b);
        }, this);

        this.set ({collection: col, models: col.models});
        Media.Model.prototype.initialize.call (this);
    },
    updateMD5: function (models) {
        if (server)
            return;
        var spark = new SparkMD5();
        spark.append (this.get('name') || 'NULL');

        console.log ('(MODEL) about to calculate MD5 for', models);

        models.forEach(function (e) {spark.append(e);});
        this.set_id(spark.end());
    },

    defaults: {
        collection: null,
        models: [],
        name: null,
        hash: null,
        fixed: false,
        pos: 0,
    },
});

Media.Universe = Media.Collection.extend ({
    url: 'list',
    model: Media.List,
});

if(server) module.exports = Media;
else root.Media = Media;
