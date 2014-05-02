/*globals $*/
$(function () {
    'use strict';

    var VIEWPORT_DESKTOP_MINWIDTH = 1000;

    var Game = function (options) {

        var rAF = (function () {
            return  window.requestAnimationFrame   ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame    ||
                function (callback) {
                    window.setTimeout(callback, 1000 / 60);
                };
        })(),
            keyState = {},
            movementState = {},
            self = this;

        this.config = {
            boardWidth          : 320,
            boardHeight         : 480,
            characterWidth      : 42,
            characterHeight     : 30,
            gammaLeft           : -25,
            gammaRight          : 25,

            leapHeight          : 140,
            leapDuration        : 0.7,
            leapLeft            : 10,
            leapInterval        : 50,

            stairWidth          : 80,
            stairLeftMin        : 0,
            stairLeftMax        : 220, // boardWidth - stairWidth
            stairHeight         : 30,
            stairHeightDiff     : 100,
            stairToleranceUp    : 5,
            stairToleranceDown  : 15,
            stairNumber         : 8,
            stairP              : 40,
            stairMoveSpeed      : 4
        };

        this.init = function (options) {
            this.setConfig();
            this.$game = $('#game');
            this.$game.css({
                height: this.config.boardHeight,
                width: this.config.boardWidth
            });
            this.registerEvents();
            return this;
        };

        this.setConfig = function () {
            this.setViewPort();
            this.setVA(this.config.leapDuration, this.config.leapHeight);
        };

        this.setViewPort = function () {
            var viewportWidth = $(window).width();
            var viewportHeight = $(window).height();
            if (viewportWidth < VIEWPORT_DESKTOP_MINWIDTH) {
                this.config.boardWidth = viewportWidth;
                this.config.boardHeight = viewportHeight;
                this.config.stairLeftMax = this.config.boardWidth - this.config.stairWidth;
            }
        };

        this.setVA = function (t, s) {
            var inital = getVA(t, s);
            this.config.v0 = inital.v;
            this.config.a_down = inital.a_down;
            this.config.a_up = inital.a_up;
        };

        this.registerEvents = function () {
            window.addEventListener('keydown', function (e) {
                keyState[e.keyCode || e.which] = true;
            }, true);

            window.addEventListener('keyup', function (e) {
                keyState[e.keyCode || e.which] = false;
            }, true);
            if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', function (e) {
                    if (e.gamma < self.config.gammaLeft) {
                        movementState['left'] = true;
                        movementState['right'] = false;
                    } else if (e.gamma > self.config.gammaRight) {
                        movementState['right'] = true;
                        movementState['left'] = false;
                    } else {
                        movementState['right'] = false;
                        movementState['left'] = false;
                    }
                }, false);
            }
            $(document).on('click', '#menu .go', function () {
                self.start();
            });
            $(document).on('click', '#game .again', function () {
                self.showMenu();
            });
        };

        this.showMenu = function () {
            $('#game').empty().append($('#menu-tpl').html());
        };

        this.start = function () {
            this.setDOM();
            this.resetStatus();
            this.drawStairs();
            this.gameLoop();
            this.leap();
            return this;
        };

        this.setDOM = function () {
            $('#menu').replaceWith($('#main-tpl').html());
            this.$character = $('#character');
            this.$score = $('#score span');
            this.$best = $('#best span');
            this.audioWing = document.getElementById('audio-wing');
            this.audioHit = document.getElementById('audio-hit');
            // Hack for mobile device
            this.audioWing.play();
            this.audioWing.pause();
            this.audioHit.play();
            this.audioHit.pause();
        };

        this.resetStatus = function () {
            this.status = {
                score: 0,
                isGameOver: false,
                isGoingDown: false,
                changeDirection: true,
                t0: +new Date(),
                bottom: 0,
                stairsInfo: []
            };
            keyState = {};
            movementState = {};
            $('.stair', this.$game).remove();
            this.$score.html(0);
            this.$best.html(this.getBest());
            this.$character
                .addClass('swing');
        };

        this.gameOver = function () {
            this.audioHit.play();
            $('.overlay', this.$game).show();
            $('.overlay .game-over span', this.$game).html(this.status.score);
            this.$character.removeClass('swing');
            this.status.isGameOver = true;
        };

        /************* Stairs Management *************/

        this.drawStairs = function () {
            var stairs = [];
            for (var i = 0; i < this.config.stairNumber; i++) {
                stairs.push(this.createStair(i, (i + 1) * this.config.stairHeightDiff));
            }
            this.$game.prepend(stairs);
        };

        this.getLastStair = function () {
            return this.status.stairsInfo[this.status.stairsInfo.length - 1];
        };

        this.createStair = function (index, bottom) {
            var width = this.config.stairWidth;
            var left = getRandomInt(this.config.stairLeftMin, this.config.stairLeftMax);
            var stair = {
                index: index,
                bottom: bottom,
                top: bottom + this.config.stairHeight,
                width: width,
                left_min: left,
                left_max: left + width
            };
            if (index > 10 && getRandomInt(1, 100) <= this.config.stairP) {
                stair.moveable = true;
                stair.direction = width % 2 ? true : false; // true: go left, false: go right
            }
            this.status.stairsInfo.push(stair);
            return $('<div>').addClass('stair')
                .attr('id', 'stair-' + index)
                .css({
                    bottom: bottom + 'px',
                    width: width,
                    left: left
                });
        };

        this.removeStair = function (index) {
            for (var i = 0, len = this.status.stairsInfo.length - 1; i < len; i++) {
                var stair = this.status.stairsInfo[i];
                if (stair.index === index) {
                    self.status.stairsInfo.splice(i, 1);
                    $('#stair-' + index).remove();
                }
            }
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

        this.stairUpCheck = function (curBottom) {
            var curLeft = getPX(this.$character.css('left'));
            var result = this.checkStairUp(curBottom, curLeft + this.config.characterWidth / 2);
            if (result) {
                this.updateScore(result);
                this.status.isGoingDown = false;
                this.status.changeDirection = true;
            }
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

        this.moveableStairs = function () {
            this.status.stairsInfo.forEach(function (stair) {
                if (stair.moveable) {
                    var left = stair.left_min;
                    var l;
                    if (stair.direction) {
                        if (left > self.config.stairMoveSpeed) {
                            l = left - self.config.stairMoveSpeed;
                        } else {
                            l = 0;
                            stair.direction = !stair.direction;
                        }
                    } else {
                        if (left < self.config.boardWidth - stair.width - self.config.stairMoveSpeed) {
                            l = left + self.config.stairMoveSpeed;
                        } else {
                            l = self.config.boardWidth - stair.width;
                            stair.direction = !stair.direction;
                        }
                    }
                    $('#stair-' + stair.index).css('left', l + 'px');
                    stair.left_min = l;
                    stair.left_max = l + stair.width;
                }
            });
        };

        /************* Stairs Management End *************/

        this.gameLoop = function () {
            (function loop() {
                if (!self.status.isGameOver) {
                    rAF(loop);
                }
                self.characterHorizontalMove();
                self.moveableStairs();
            })();
        };

        this.leap = function () {
            this.times = 0;
            this.interval = setInterval(function () {
                if (self.status.changeDirection) {
                    self.status.t0 = +new Date();
                    self.status.curBottom = getPX(self.$character.css('bottom'));
                    self.status.changeDirection = false;
                    if (!self.status.isGoingDown) {
                        self.audioWing.play();
                    }
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
                this.status.changeDirection = true;
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
                    this.status.changeDirection = true;
                }
            } else {
                this.$character.css('bottom', bottom + 'px');
                this.stairUpCheck(bottom);
            }
        };

        this.characterHorizontalMove = function () {
            var left = getPX(this.$character.css('left'));
            var l;
            if (keyState[37] || keyState[65] || movementState['left']) {
                this.$character.addClass('left');
                l = left >= this.config.leapLeft ? left - this.config.leapLeft : 0;
            }
            if (keyState[39] || keyState[68] || movementState['right']) {
                this.$character.removeClass('left');
                if (left <= this.config.boardWidth - this.config.characterWidth - this.config.leapLeft) {
                    l = left + this.config.leapLeft;
                } else {
                    l = this.config.boardWidth - this.config.characterWidth;
                }
            }
            this.$character.css('left', l);
        };

        this.updateScore = function (stair) {
            var score = stair.index + 1;
            if (this.status.score < score) {
                this.status.score = score;
                this.$score.html(score);
            }
            if (this.getBest() < score) {
                this.setBest(score);
            }
        };

        this.getBest = function () {
            if (localStorage) {
                return localStorage.getItem('best') || 0;
            }
            return 0;
        };

        this.setBest = function (score) {
            if (localStorage) {
                localStorage.setItem('best', score);
            }
            this.$best.html(score);
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
