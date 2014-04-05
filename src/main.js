$(function () {
    'use strict';

    var Game = function (options) {

        var rAF = (function(){
            return  window.requestAnimationFrame   ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame    ||
                function( callback ){
                    window.setTimeout(callback, 1000 / 60);
                };
        })(),
            keyState = {},
            touchState = {},
            self = this;

        this.config = {
            boardWidth          : 300,
            boardHeight         : 400,
            characterWidth      : 42,
            characterHeight     : 30,

            leapUp              : 100,
            leapDuration        : 0.6,
            leapLeft            : 10,
            leapInterval        : 30,

            stairWidthMin       : 40,
            stairWidthMax       : 100,
            stairLeftMin        : 0,
            stairLeftMax        : 200, // boardWidth - stairWidthMax
            stairHeight         : 15,
            stairHeightDiff     : 60,
            stairToleranceUp    : 5,
            stairToleranceDown  : 15,
            stairNumber         : 8,

            wingDuration        : 100
        };

        this.init = function (options) {
            var inital = getVA(this.config.leapDuration, this.config.leapUp);
            this.config.v0 = inital.v;
            this.config.a_down = inital.a_down;
            this.config.a_up = inital.a_up;
            this.$character = $('#character');
            this.$game = $('#game');
            this.$score = $('#score span');
            this.$touchzone = $('#touchzone');
            this.registerEvents();
            this.resetStatus();
            return this;
        };

        this.start = function () {
            this.status.isGameOver = false;
            this.drawStairs();
            this.gameLoop();
            this.characterFly();
            this.leap();
            return this;
        };

        this.registerEvents = function () {
            window.addEventListener('keydown', function(e){
                keyState[e.keyCode || e.which] = true;
            }, true);

            window.addEventListener('keyup', function(e){
                keyState[e.keyCode || e.which] = false;
            }, true);
            this.$touchzone.on('touchstart', function (e) {
                if ($(e.target).hasClass('left')) {
                    touchState['left'] = true;
                    touchState['right'] = false;
                } else if ($(e.target).hasClass('right')) {
                    touchState['right'] = true;
                    touchState['left'] = false;
                }
            });
            this.$touchzone.on('touchend', function (e) {
                if ($(e.target).hasClass('left')) {
                    touchState['left'] = false;
                } else if ($(e.target).hasClass('right')) {
                    touchState['right'] = false;
                }
            });
        };

        /************* Stairs Management *************/

        this.drawStairs = function () {
            var stairs = [];
            for(var i = 0; i < this.config.stairNumber; i++) {
                stairs.push(this.createStair(i, (i + 1) * this.config.stairHeightDiff));
            }
            this.$game.prepend(stairs);
        };

        this.getLastStair = function () {
            return this.status.stairsInfo[this.status.stairsInfo.length - 1];
        };

        this.createStair = function (index, bottom) {
            var width = getRandomInt(this.config.stairWidthMin, this.config.stairWidthMax);
            var left = getRandomInt(this.config.stairLeftMin, this.config.stairLeftMax);
            this.status.stairsInfo.push({
                index: index,
                bottom: bottom,
                top: bottom + this.config.stairHeight,
                left_min: left,
                left_max: left + width
            });
            return $('<div>').addClass('stair')
                .attr('id', 'stair-' + index)
                .css({
                    bottom: bottom + 'px',
                    width: width,
                    left: left
                });
        };

        this.removeStair = function (index) {
            this.status.stairsInfo.forEach(function (stair, key) {
                if (stair.index === index) {
                    self.status.stairsInfo.splice(key, 1);
                    $('#stair-' + index).remove();
                }
            });
        };

        this.stairsMoveDown = function (dh) {
            this.status.stairsInfo.forEach(function (stair) {
                $('#stair-' + stair.index).css('bottom', (stair.bottom - dh) + 'px');
            });
        };

        this.updateStairsInfo = function () {
            var toBeRemoved = [];
            this.status.stairsInfo.forEach(function (stair) {
                var bottom = getPX($('#stair-' + stair.index).css('bottom'));
                if (bottom < 0) {
                    toBeRemoved.push(stair);
                } else {
                    stair.bottom = bottom;
                    stair.top = bottom + self.config.stairHeight;
                }
            });
            toBeRemoved.forEach(function (stair) {
                self.removeStair(stair.index);
                var lastStair = self.getLastStair();
                var newStair = self.createStair(lastStair.index + 1, lastStair.top + self.config.stairHeightDiff);
                self.$game.prepend(newStair);
            });
        };

        this.checkStairUp = function (bottom, left) {
            var result;
            this.status.stairsInfo.forEach(function (stair) {
                if (bottom <= stair.top + self.config.stairToleranceUp &&
                    bottom >= stair.top - self.config.stairToleranceDown &&
                    left > stair.left_min &&
                    left < stair.left_max) {
                    result = stair;
                    return false;
                }
            });
            return result;
        };

        /************* Stairs Management End *************/

        this.gameLoop = function () {
            (function gameLoop () {
                if (!self.status.isGameOver) {
                    rAF(gameLoop);
                }
                self.characterHorizontalMove();
            })();
        };

        this.characterFly = function () {
            var direction = true;
            var fly = setInterval(function () {
                if (self.status.isGameOver) {
                    clearInterval(fly);
                    return;
                }
                var status = parseInt(self.$character.attr('class').match(/\d/)[0], 10);
                var num;
                if (status === 0 || status === 2) {
                    num = 1;
                    direction = !direction;
                } else {
                    num = direction ? 0 : 2;
                }
                self.$character.removeClass('status-0 status-1 status-2').addClass('status-' + num);
            }, this.config.wingDuration);
        };

        this.leap = function () {
            this.interval = setInterval(function () {
                if (self.status.isChanged) {
                    self.status.t0 = +new Date();
                    self.status.curBottom = getPX(self.$character.css('bottom'));
                    self.status.isChanged = false;
                }
                if (self.status.isGoingDown) {
                    self.leapDown();
                } else {
                    self.leapUp();
                }
                if (self.status.isGameOver) {
                    clearInterval(self.interval);
                }
            }, this.config.leapInterval);
        };

        this.leapUp = function () {
            var dt  = (+new Date() - this.status.t0) / 1000,
                v   = this.config.v0 + this.config.a_up * dt,
                s   = this.config.v0 * dt + this.config.a_up * dt * dt / 2;
            if (v < 0) {
                this.updateStairsInfo();
                this.status.isGoingDown = true;
                this.status.isChanged = true;
            } else {
                var dh = Math.ceil(this.status.curBottom + s - this.config.boardHeight / 2);
                if (dh > 0) {
                    this.$character.css('bottom', (this.config.boardHeight / 2) + 'px');
                    this.stairsMoveDown(dh);
                } else {
                    this.$character.css('bottom', (this.status.curBottom + s) + 'px');
                }
            }
        };

        this.leapDown = function () {
            var dt  = (+new Date() - this.status.t0) / 1000,
                s   = this.config.a_down * dt * dt / 2;

            var bottom = this.status.curBottom - s;
            if (bottom < 0) {
                this.$character.css('bottom', 0);
                if (this.status.score > 0) {
                    this.gameOver();
                } else {
                    this.status.isGoingDown = false;
                    this.status.isChanged = true;
                }
            } else {
                this.$character.css('bottom', bottom + 'px');
                this.stairUpCheck(bottom);
            }
        };

        this.characterHorizontalMove = function () {
            var left = getPX(this.$character.css('left'));
            var l;
            // Go Left
            if (keyState[37] || keyState[65] || touchState['left']) {
                this.$character.addClass('left');
                l = left >= this.config.leapLeft ? left - this.config.leapLeft : 0;
            }
            // Go Right
            if (keyState[39] || keyState[68] || touchState['right']) {
                this.$character.removeClass('left');
                if (left <= this.config.boardWidth - this.config.characterWidth - this.config.leapLeft) {
                    l = left + this.config.leapLeft;
                } else {
                    l = this.config.boardWidth - this.config.characterWidth;
                }
            }
            this.$character.css('left', l);
        };

        this.stairUpCheck = function (curBottom) {
            var curLeft = getPX(this.$character.css('left'));
            var result = this.checkStairUp(curBottom, curLeft + this.config.characterWidth / 2);
            if (result) {
                this.updateScore(result);
                this.status.isGoingDown = false;
                this.status.isChanged = true;
            }
        };

        this.updateScore = function (stair) {
            var score = stair.index + 1;
            if (this.status.score < score) {
                this.status.score = score;
                this.$score.html(score);
            }
        };

        this.gameOver = function () {
            $('.overlay', this.$game).show();
            this.status.isGameOver = true;
            this.$game.on('click', '.play-again', function () {
                self.restart();
                $('.overlay', self.$game).hide();
            });
        };

        this.restart = function () {
            this.resetStatus();
            this.start();
        };

        this.resetStatus = function () {
            this.status = {
                score: 0,
                isGameOver: true,
                isGoingDown: false,
                isChanged: true,
                t0: +new Date(),
                bottom: 0,
                stairsInfo: []
            };
            $('.stair', this.$game).remove();
            this.$score.html(0);
            this.$character
                .attr('class', 'status-1')
                .css({
                    bottom: '0px'
                });
        };

        /************* Util Methods *************/

        function getPX(strPx) {
            return parseInt(strPx.substr(0, strPx.length - 2), 10);
        }

        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        function getVA(t, s) {
            return {
                a_up: Math.floor(-2 * s / t / t),
                a_down: Math.floor(2 * s / t / t),
                v: Math.floor(2 * s / t)
            };
        }

        this.init(options);
    };

    window.Game = Game;

});
