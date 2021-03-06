#!/usr/bin/env node
// Generated by CoffeeScript 1.9.3
(function() {
  var Selector, Url, WS, WebSocket, args, chromi, chromiCap, cmd, conf, doIf, echo, echoErr, generalOperations, json, ref, requireWindow, selector, tabCallback, tabDo, tabOperations, ws,
    slice = [].slice;

  WebSocket = require("ws");

  Url = require('url');

  conf = require("optimist");

  conf = conf.usage("Usage: $0 [--port=PORT] [--server=SERVER]");

  conf = conf["default"]("port", 7441);

  conf = conf["default"]("server", "localhost");

  conf = conf["default"]("timeout", "500");

  conf = conf.argv;

  chromi = "chromi";

  chromiCap = "Chromi";

  json = function(x) {
    return JSON.stringify(x);
  };

  echo = function(msg, where) {
    if (where == null) {
      where = process.stdout;
    }
    switch (typeof msg) {
      case "string":
        true;
        break;
      case "list":
        msg = msg.join(" ");
        break;
      default:
        msg = json(msg);
    }
    return where.write(msg + "\n");
  };

  echoErr = function(msg, die) {
    if (die == null) {
      die = false;
    }
    echo(msg, process.stderr);
    if (die) {
      return process.exit(1);
    }
  };

  Selector = (function() {
    Selector.prototype.selector = {};

    Selector.prototype.fetch = function(pattern) {
      var regexp;
      if (pattern in this.selector) {
        return this.selector[pattern];
      }
      if (parseInt(pattern)) {
        return this.selector[pattern] = function(win, tab) {
          return tab.id === pattern;
        };
      } else {
        regexp = new RegExp(pattern);
        return this.selector[pattern] = function(win, tab) {
          return win.type === "normal" && regexp.test(tab.url);
        };
      }
    };

    Selector.prototype.host = function(host) {
      return function(win, tab) {
        var ref;
        return ((ref = Url.parse(tab.url)) != null ? ref.host : void 0) === host;
      };
    };

    function Selector() {
      this.selector.window = function(win, tab) {
        return win.type === "normal";
      };
      this.selector.all = (function(_this) {
        return function(win, tab) {
          return _this.fetch("window")(win, tab);
        };
      })(this);
      this.selector.current = (function(_this) {
        return function(win, tab) {
          return _this.fetch("window")(win, tab) && tab.active;
        };
      })(this);
      this.selector.other = (function(_this) {
        return function(win, tab) {
          return _this.fetch("window")(win, tab) && !tab.active;
        };
      })(this);
      this.selector.chrome = (function(_this) {
        return function(win, tab) {
          return !_this.fetch("normal")(win, tab);
        };
      })(this);
      this.selector.normal = (function(_this) {
        return function(win, tab) {
          return ["http", "file", "ftp"].reduce((function(p, c) {
            return p || _this.fetch(c)(win, tab);
          }), false);
        };
      })(this);
      this.selector.http = this.fetch("https?://");
      this.selector.file = this.fetch("file://");
      this.selector.ftp = this.fetch("ftp://");
      this.selector.active = (function(_this) {
        return function(win, tab) {
          return _this.fetch("current")(win, tab);
        };
      })(this);
      this.selector.inactive = (function(_this) {
        return function(win, tab) {
          return _this.fetch("other")(win, tab);
        };
      })(this);
      this.selector.pinned = (function(_this) {
        return function(win, tab) {
          return tab.pinned;
        };
      })(this);
      this.selector.pinnedOrCurrent = (function(_this) {
        return function(win, tab) {
          return _this.selector.pinned(win, tab) || _this.selector.current(win, tab);
        };
      })(this);
    }

    return Selector;

  })();

  selector = new Selector();

  WS = (function() {
    function WS() {
      this.whitespace = /\s+/;
      this.queue = [];
      this.ready = false;
      this.callbacks = {};
      this.ws = new WebSocket("ws://" + conf.server + ":" + conf.port + "/");
      this.ws.on("error", function(error) {
        return echoErr(json(error), true);
      });
      this.ws.on("open", (function(_this) {
        return function() {
          _this.ready = true;
          _this.queue.forEach(function(request) {
            return request();
          });
          return _this.queue = [];
        };
      })(this));
      this.ws.on("message", (function(_this) {
        return function(msg) {
          var msgId, ref, response, signal, type;
          ref = msg = msg.split(_this.whitespace), signal = ref[0], msgId = ref[1], type = ref[2], response = ref[3];
          if (signal === chromiCap && _this.callbacks[msgId]) {
            switch (type) {
              case "info":
                return true;
              case "done":
                return _this.callback(msgId, response);
              case "error":
                return echoErr(msg.join(" "), true);
              default:
                return echoErr(msg.join(" "), true);
            }
          }
        };
      })(this));
    }

    WS.prototype.send = function(msg, callback) {
      var id, request;
      id = this.createId();
      request = (function(_this) {
        return function() {
          _this.register(id, callback);
          return _this.ws.send(chromi + " " + id + " " + msg);
        };
      })(this);
      if (this.ready) {
        return request();
      } else {
        return this.queue.push(request);
      }
    };

    WS.prototype.register = function(id, callback) {
      this.callbacks[id] = callback;
      return setTimeout(((function(_this) {
        return function() {
          if (_this.callbacks[id]) {
            return process.exit(1);
          }
        };
      })(this)), conf.timeout);
    };

    WS.prototype.callback = function(id, argument) {
      var callback;
      if (argument == null) {
        argument = null;
      }
      callback = this.callbacks[id];
      delete this.callbacks[id];
      return callback(argument);
    };

    WS.prototype["do"] = function(func, args, callback) {
      var msg;
      msg = [func, json(args)].map(encodeURIComponent).join(" ");
      return this.send(msg, function(response) {
        return callback.apply(null, JSON.parse(decodeURIComponent(response)));
      });
    };

    WS.prototype.createId = function() {
      return Math.floor(Math.random() * 2000000000);
    };

    return WS;

  })();

  ws = new WS();

  tabDo = function(predicate, eachTab, callback) {
    return ws["do"]("chrome.windows.getAll", [
      {
        populate: true
      }
    ], function(wins) {
      var count, intransit;
      count = 0;
      intransit = 0;
      wins.forEach(function(win) {
        return win.tabs.filter(function(tab) {
          return predicate(win, tab);
        }).forEach(function(tab) {
          count += 1;
          intransit += 1;
          return eachTab(win, tab, function() {
            return process.nextTick(function() {
              intransit -= 1;
              if (intransit === 0) {
                return callback(count);
              }
            });
          });
        });
      });
      if (count === 0) {
        return callback(0);
      }
    });
  };

  tabCallback = function(tab, name, callback) {
    return function(response) {
      echo("done " + name + ": " + tab.id + " " + tab.url);
      return callback();
    };
  };

  requireWindow = function(callback) {
    return tabDo(selector.fetch("window"), function(win, tab, callback) {
      return callback();
    }, function(count) {
      if (0 < count) {
        return callback(false);
      } else {
        return ws["do"]("chrome.windows.create", [{}], function(response) {
          return callback(true);
        });
      }
    });
  };

  doIf = function(test, errMsg, callback, work) {
    if (test) {
      return work();
    } else {
      echoErr(errMsg);
      return callback(1);
    }
  };

  tabOperations = {
    focus: function(msg, tab, callback) {
      return doIf(msg.length === 0, "invalid focus: " + msg, callback, function() {
        return ws["do"]("chrome.tabs.update", [
          tab.id, {
            selected: true
          }
        ], tabCallback(tab, "focus", callback));
      });
    },
    reload: function(msg, tab, callback, bypassCache) {
      if (bypassCache == null) {
        bypassCache = false;
      }
      return doIf(msg.length === 0, "invalid reload: " + msg, callback, function() {
        return ws["do"]("chrome.tabs.reload", [
          tab.id, {
            bypassCache: bypassCache
          }
        ], tabCallback(tab, "reload", callback));
      });
    },
    reloadWithoutCache: function(msg, tab, callback) {
      return doIf(msg.length === 0, "invalid reloadWithoutCache: " + msg, callback, (function(_this) {
        return function() {
          return _this.reload(msg, tab, callback, true);
        };
      })(this));
    },
    close: function(msg, tab, callback) {
      return doIf(msg.length === 0, "invalid close: " + msg, callback, function() {
        return ws["do"]("chrome.tabs.remove", [tab.id], tabCallback(tab, "close", callback));
      });
    },
    goto: function(msg, tab, callback) {
      return doIf(msg.length === 1, "invalid goto: " + msg, callback, function() {
        return ws["do"]("chrome.tabs.update", [
          tab.id, {
            selected: true,
            url: msg[0]
          }
        ], tabCallback(tab, "goto", callback));
      });
    },
    list: function(msg, tab, callback) {
      return doIf(msg.length === 0, "invalid list: " + msg, callback, function() {
        echo(tab.id + " " + tab.url + " " + tab.title);
        return callback();
      });
    },
    url: function(msg, tab, callback) {
      return doIf(msg.length === 0, "invalid list: " + msg, callback, function() {
        echo("" + tab.url);
        return callback();
      });
    },
    duplicate: function(msg, tab, callback) {
      return doIf(msg.length === 0, "invalid duplicate: " + msg, callback, function() {
        return ws["do"]("chrome.tabs.duplicate", [tab.id], tabCallback(tab, "duplicate", callback));
      });
    },
    pin: function(msg, tab, callback) {
      return doIf(msg.length === 0, "invalid pin: " + msg, callback, function() {
        return ws["do"]("chrome.tabs.update", [
          tab.id, {
            pinned: true
          }
        ], tabCallback(tab, "pin", callback));
      });
    },
    unpin: function(msg, tab, callback) {
      return doIf(msg.length === 0, "invalid unpin: " + msg, callback, function() {
        return ws["do"]("chrome.tabs.update", [
          tab.id, {
            pinned: false
          }
        ], tabCallback(tab, "unpin", callback));
      });
    }
  };

  generalOperations = {
    window: function(msg, callback) {
      return doIf(msg.length === 0, "invalid window: " + msg, callback, function() {
        return requireWindow(function() {
          return callback();
        });
      });
    },
    load: function(msg, callback) {
      return doIf(msg.length === 1, "invalid load: " + msg, callback, function() {
        var url, urlNoQuery;
        url = msg[0];
        urlNoQuery = url;
        return requireWindow(function(created) {
          return tabDo(selector.fetch(urlNoQuery), function(win, tab, callback) {
            return tabOperations.focus([], tab, function() {
              if (selector.fetch("file")(win, tab)) {
                return tabOperations.reload([], tab, callback);
              } else {
                return callback();
              }
            });
          }, function(count) {
            if (count === 0) {
              return ws["do"]("chrome.tabs.create", [
                {
                  url: url
                }
              ], function(response) {
                echo("done create: " + url);
                if (created) {
                  return generalOperations["with"](["^chrome://newtab/", "close"], function() {
                    return callback();
                  });
                } else {
                  return callback();
                }
              });
            } else {
              return callback();
            }
          });
        });
      });
    },
    move: function(msg, callback) {
      return doIf(msg.length === 1, "invalid load: " + msg, callback, function() {
        var doneMove, url, urlNoQuery, urlParsed;
        url = msg[0];
        urlNoQuery = url;
        urlParsed = Url.parse(url);
        if (!urlParsed.host) {
          return generalOperations.load(msg, callback);
        }
        doneMove = false;
        return requireWindow(function(created) {
          return tabDo(selector.host(urlParsed.host), function(win, tab, callback) {
            if (doneMove) {
              return callback();
            } else {
              doneMove = true;
              return tabOperations.focus([], tab, function() {
                if (tab.url === url) {
                  return callback();
                } else {
                  return tabOperations.goto(msg, tab, callback);
                }
              });
            }
          }, function(count) {
            if (count === 0) {
              return ws["do"]("chrome.tabs.create", [
                {
                  url: url
                }
              ], function(response) {
                echo("done create: " + url);
                if (created) {
                  return generalOperations["with"](["^chrome://newtab/", "close"], callback);
                } else {
                  return callback();
                }
              });
            } else {
              return callback();
            }
          });
        });
      });
    },
    "with": function(msg, callback, predicate) {
      if (predicate == null) {
        predicate = null;
      }
      return doIf((1 <= msg.length && predicate) || (2 <= msg.length && !predicate), "invalid with: " + msg, callback, function() {
        var cmd, ref, ref1, what;
        if (!predicate) {
          ref = msg, what = ref[0], msg = 2 <= ref.length ? slice.call(ref, 1) : [];
          predicate = selector.fetch(what);
        }
        ref1 = msg, cmd = ref1[0], msg = 2 <= ref1.length ? slice.call(ref1, 1) : [];
        return tabDo(predicate, function(win, tab, callback) {
          if (cmd && tabOperations[cmd]) {
            return tabOperations[cmd](msg, tab, callback);
          } else {
            return echoErr("invalid with command: " + cmd, true);
          }
        }, function(count) {
          return callback();
        });
      });
    },
    without: function(msg, callback) {
      return doIf(2 <= msg.length, "invalid without: " + msg, callback, (function(_this) {
        return function() {
          var ref, what;
          ref = msg, what = ref[0], msg = 2 <= ref.length ? slice.call(ref, 1) : [];
          return _this["with"](msg, callback, function(win, tab) {
            return !selector.fetch(what)(win, tab);
          });
        };
      })(this));
    },
    ping: function(msg, callback) {
      return doIf(msg.length === 0, "invalid ping: " + msg, callback, function() {
        return ws["do"]("ping", [], function(response) {
          return callback();
        });
      });
    },
    newTab: function(msg, callback) {
      return doIf(msg.length === 0, "invalid newTab: " + msg, callback, function() {
        var url;
        url = "chrome://newtab/";
        return requireWindow(function(created) {
          if (created) {
            return callback();
          } else {
            return ws["do"]("chrome.tabs.create", [
              {
                url: url
              }
            ], function(response) {
              echo("done create new tab: " + url);
              return callback();
            });
          }
        });
      });
    },
    raw: function(msg, callback) {
      return doIf(true, "invalid raw: " + msg, callback, function() {
        var cmd, error, ref;
        ref = msg, cmd = ref[0], msg = 2 <= ref.length ? slice.call(ref, 1) : [];
        try {
          msg = msg.map(JSON.parse);
        } catch (_error) {
          error = _error;
          echoErr("json parse error: " + msg);
        }
        return ws["do"](cmd, msg, function(response) {
          echo(response);
          return callback();
        });
      });
    },
    bookmarks: function(msg, callback, output) {
      if (output == null) {
        output = function(bm) {
          return echo(bm.url + " " + bm.title);
        };
      }
      return doIf(msg.length === 0, "invalid bookmarks: " + msg, callback, (function(_this) {
        return function() {
          var recursiveBookmarks;
          recursiveBookmarks = function(output, bookmark) {
            if (bookmark == null) {
              bookmark = null;
            }
            if (!bookmark) {
              return ws["do"]("chrome.bookmarks.getTree", [], function(bookmarks) {
                bookmarks.forEach(function(bmark) {
                  if (bmark) {
                    return recursiveBookmarks(output, bmark);
                  }
                });
                return callback();
              });
            } else {
              if (bookmark.url && bookmark.title) {
                output(bookmark);
              }
              if (bookmark.children) {
                return bookmark.children.forEach(function(bmark) {
                  return recursiveBookmarks(output, bmark);
                });
              }
            }
          };
          return recursiveBookmarks(output);
        };
      })(this));
    },
    booky: function(msg, callback) {
      var regexp;
      regexp = /(\([A-Z0-9]+\))/g;
      return this.bookmarks(msg, callback, function(bmark) {
        return (bmark.title.match(regexp) || []).forEach(function(bm) {
          bm = bm.slice(1, -1).toLowerCase();
          return echo(bm + " " + bmark.url);
        });
      });
    }
  };

  args = conf._;

  if (args.length === 0) {
    args = ["ping"];
  }

  if (args && args[0] && tabOperations[args[0]] && !generalOperations[args[0]]) {
    args.unshift("with", "current");
  }

  ref = args, cmd = ref[0], args = 2 <= ref.length ? slice.call(ref, 1) : [];

  if (cmd && generalOperations[cmd]) {
    generalOperations[cmd](args, function(code) {
      if (code == null) {
        code = 0;
      }
      return process.exit(code);
    });
  } else {
    echoErr("invalid command: " + cmd + " " + args, true);
  }

}).call(this);
