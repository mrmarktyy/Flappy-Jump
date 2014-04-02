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
            self = this;

        this.config = {
            boardWidth          : 300,
            boardHeight         : 400,
            characterWidth      : 42,
            characterHeight     : 30,

            leapLeft            : 10,
            leapUp              : 100,
            leapUpDruation      : 600,
            leapDownDuration    : 600,

            stairHeight         : 15,
            stairHeightDiff     : 60,
            stairToleranceUp    : 5,
            stairToleranceDown  : 5,
            stairInitNumber     : 8
        };

        this.init = function (options) {
            this.registerKeyEvents();
            this.$character = $('#character');
            this.$game = $('#game');
            this.$score = $('#score span');
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

        this.registerKeyEvents = function () {
            window.addEventListener('keydown', function(e){
                keyState[e.keyCode || e.which] = true;
            }, true);

            window.addEventListener('keyup', function(e){
                keyState[e.keyCode || e.which] = false;
            }, true);
        };

        /************* Stairs Management *************/

        this.drawStairs = function () {
            var stairs = [];
            for(var i = 0; i < this.config.stairInitNumber; i++) {
                stairs.push(createStair(i, (i + 1) * this.config.stairHeightDiff));
            }
            this.$game.prepend(stairs);
        };

        function createStair (index, bottom) {
            var width = getRandomInt(40, 100);
            var left = getRandomInt(0, 200);
            self.status.stairsInfo.push({
                index: index,
                bottom: bottom + self.config.stairHeight,
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
        }

        function removeStair (index) {
            self.status.stairsInfo.forEach(function (stair, key) {
                if (stair.index === index) {
                    self.status.stairsInfo.splice(key, 1);
                    $('#stair-' + index).remove();
                }
            });
        }

        function updateStairs (diff, duration) {
            self.status.stairsInfo.forEach(function (stair) {
                stair.bottom -= diff;
                $('#stair-' + stair.index).animate({
                    bottom: stair.bottom
                }, {
                    duration: duration,
                    easing: 'linear',
                    complete: function () {
                        if (stair.bottom < 0) {
                            removeStair(stair.index);
                            var lastStair = self.status.stairsInfo[self.status.stairsInfo.length - 1];
                            var newStair = createStair(lastStair.index + 1, lastStair.bottom + self.config.stairHeightDiff);
                            self.$game.prepend(newStair);
                        }
                    }
                });
            });
        }

        function checkStairUp (bottom, left) {
            var result;
            self.status.stairsInfo.forEach(function (stair) {
                if (bottom <= stair.bottom + self.config.stairToleranceUp &&
                    bottom >= stair.bottom - self.config.stairHeight - self.config.stairToleranceDown &&
                    left > stair.left_min &&
                    left < stair.left_max) {
                    result = stair;
                    return false;
                }
            });
            return result;
        }

        /************* Stairs Management End *************/

        this.gameLoop = function () {
            (function gameLoop () {
                if (!self.status.isGameOver) {
                    rAF(gameLoop);
                }
                self.characterHorizontalMove();
                self.stairUpCheck();
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
            }, 200);
        };

        this.leap = function () {
            this.leapUp();
            this.leapDown();
        };

        this.leapUp = function () {
            var curBottom = getPX(this.$character.css('bottom')),
                isStairMove = false,
                up, duration, downStairs, durationStairs;
            if ((curBottom + this.config.leapUp) < this.config.boardHeight / 2) {
                up = this.config.leapUp;
                duration = this.config.leapUpDruation;
                this.status.delay = 0;
            } else {
                isStairMove = true;
                up = this.config.boardHeight / 2 - curBottom;
                duration = Math.floor(this.config.leapUpDruation * up / this.config.leapUp);
                downStairs = this.config.leapUp - up;
                this.status.delay = this.config.leapUpDruation - duration;
            }
            this.$character
                .animate({
                    bottom: '+=' + up
                }, {
                    duration: duration,
                    easing: 'swing',
                    start: function () {
                        self.status.isGoingDown = false;
                    },
                    complete: function () {
                        self.status.bottom = curBottom + up;
                        if (isStairMove) {
                            updateStairs(downStairs, self.status.delay);
                        }
                    }
                });
        };

        this.leapDown = function () {
            this.$character.delay(this.status.delay).animate({
                    bottom: 0
                }, {
                    duration: this.config.leapDownDuration * this.status.bottom / this.config.leapUp,
                    easing: 'swing',
                    start: function () {
                        self.status.isGoingDown = true;
                    },
                    complete: function () {
                        if (self.status.score > 0) {
                            self.gameOver();
                        } else {
                            self.leap();
                        }
                    }
                });
        };

        this.characterHorizontalMove = function () {
            var left = getPX(this.$character.css('left'));
            var l;
            // Go Left
            if (keyState[37] || keyState[65]) {
                this.$character.addClass('left');
                l = left >= this.config.leapLeft ? left - this.config.leapLeft : 0;
            }
            // Go Right
            if (keyState[39] || keyState[68]) {
                this.$character.removeClass('left');
                if (left <= this.config.boardWidth - this.config.characterWidth - this.config.leapLeft) {
                    l = left + this.config.leapLeft;
                } else {
                    l = this.config.boardWidth - this.config.characterWidth;
                }
            }
            this.$character.css('left', l);
        };

        this.stairUpCheck = function () {
            if (this.status.isGoingDown) {
                var curBottom = getPX(this.$character.css('bottom'));
                var curLeft = getPX(this.$character.css('left'));
                var result = checkStairUp(curBottom, curLeft);
                if (result) {
                    this.$character.stop();
                    this.updateScore(result);
                    this.leap();
                }
            }
        };

        this.updateScore = function (stair) {
            var score = parseInt(this.$score.html(), 10);
            if (score < stair.index) {
                this.status.score = stair.index;
                this.$score.html(stair.index);
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
            $('.stair', this.$game).remove();
            this.$score.html(0);
            this.resetStatus();
            this.start();
        };

        this.resetStatus = function () {
            this.status = {
                score: 0,
                isGameOver: true,
                bottom: this.config.leapUp,
                stairsInfo: []
            };
        };

        /************* Util Methods *************/

        function getPX(strPx) {
            return parseInt(strPx.substr(0, strPx.length - 2), 10);
        }

        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        this.init(options);
    };

    window.Game = Game;

});
