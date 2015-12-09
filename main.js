/*
 * Copyright (c) 2015 Equals182.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50  */
/*global define, brackets, Mustache, $*/

define(function (require, exports, module) {
    "use strict";
    
    var AppInit = brackets.getModule("utils/AppInit"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        EditorManager = brackets.getModule("editor/EditorManager"),
        CommandManager = brackets.getModule("command/CommandManager"),
        KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        _ = brackets.getModule('thirdparty/lodash'),
        random = _.random,
        
        preferences = PreferencesManager.getExtensionPrefs("brackets-power-mode");
    
    preferences.definePreference("screenShake.enabled", "boolean", true);
    preferences.definePreference("screenShake.minIntensity", "integer", 1);
    preferences.definePreference("screenShake.maxIntensity", "integer", 3);
    
    preferences.definePreference("particles.enabled", "boolean", true);
    preferences.definePreference("particles.totalCount.max", "integer", 500);
    preferences.definePreference("particles.spawnCount.min", "integer", 5);
    preferences.definePreference("particles.spawnCount.max", "integer", 15);
    preferences.definePreference("particles.size.min", "integer", 2);
    preferences.definePreference("particles.size.max", "integer", 4);
    
    preferences.definePreference("active", "boolean", false);
    
    var pm = {
        config: {},
        getConfig: function (config) {
            if (!pm.config[config]) {
                pm.config[config] = preferences.get(config);
            }
            return pm.config[config];
        },
        active: false,
        activate: function (state) {
            EditorManager.on('activeEditorChange', function () {
                return pm.subscribeToActiveTextEditor();
            });
            pm.particlePointer = 0;
            pm.particles = [];
            pm.subscribeToActiveTextEditor();
            pm.active = pm.getConfig('active');
            pm.setupCanvas();
        },
        particles: {},
        particlePointer: NaN,
        subscribeToActiveTextEditor: function () {
            var _ref;
            pm.throttledShake = _.throttle(pm.shake.bind(pm), 100, { trailing: false });
            pm.throttledSpawnParticles = _.throttle(pm.spawnParticles.bind(pm), 25, { trailing: false });
            pm.editor = EditorManager.getActiveEditor();
            if (!pm.editor) {
                return;
            }
            pm.editorElement = pm.editor.getRootElement();
            pm.editorElement.classList.add("power-mode");
            pm.editor.on('keydown', function (e, editor, ke) {
                pm.onChange(e, editor, ke);
            });
            requestAnimationFrame(pm.drawParticles.bind(pm));
            if (pm.canvas) {
                pm.canvas.style.display = "block";
                return true;
            }
        },
        onChange: function (e, editor, ke) {
            var range, spawnParticles;
            if (!pm.active) {
                return;
            }
            spawnParticles = true;

            if (ke.altKey) {
                return;
            }
            if (ke.keyCode === 37 || ke.keyCode === 38 || ke.keyCode === 39 || ke.keyCode === 40) {
                return;
            }
            if (ke.keyCode === 16 || ke.keyCode === 17) {
                return;
            }
            _.delay(function () {
                var curpos = pm.editor.getCursorPos(true);
                var row = $('.CodeMirror-linenumber:contains(' + (curpos.line + 1) + ')').closest('.CodeMirror-gutter-wrapper').parent().find('.CodeMirror-line>span:first'),
                    col = 0,
                    color;
                row.contents().each(function (i, o) {
                    col += $(o).text().length;
                    if (col >= curpos.ch) {
                        if ($(o)[0].nodeType === 3) {
                            color = $($(o)[0].parentNode).css('color');
                        } else {
                            color = $(o).css('color');
                        }
                        return false;
                    }
                });
                var pos = pm.editor._codeMirror.cursorCoords();
                var r = {
                        pos: pos,
                        color: color
                    }; 
                if (ke.keyCode === 13) {
                    //spawnParticles = false;
                }
                if (spawnParticles && pm.getConfig("particles.enabled")) {
                    pm.throttledSpawnParticles(r);
                }
                if (pm.getConfig("screenShake.enabled")) {
                    return pm.throttledShake();
                }
            }, 3);
        },
        setupCanvas: function () {
            if ($('#power-mode-canvas').length === 0) {
                pm.canvas = document.createElement("canvas");
                pm.context = pm.canvas.getContext("2d");
                pm.canvas.classList.add("power-mode-canvas");
                pm.canvas.setAttribute('id', "power-mode-canvas");
                $("body").prepend(pm.canvas);
            }
            return true;
        },
        shake: function () {
            var max, min, x, y;
            min = pm.getConfig("screenShake.minIntensity");
            max = pm.getConfig("screenShake.maxIntensity");
            x = pm.shakeIntensity(min, max);
            y = pm.shakeIntensity(min, max);
            pm.editorElement.style.top = y + "px";
            pm.editorElement.style.left = x + "px";
            return setTimeout((function (_this) {
                return function () {
                    _this.editorElement.style.top = "";
                    _this.editorElement.style.left = "";
                    return true;
                };
            }(pm)), 75);
        },
        shakeIntensity: function (min, max) {
            var direction;
            direction = Math.random() > 0.5 ? -1 : 1;
            return random(min, max, true) * direction;
        },
        spawnParticles: function (range) {
            var color, cursorOffset, left, numParticles, top, _ref, _results;
            _ref = range.pos;
            left = _ref.left;
            top = _ref.top;
            top += parseFloat(window.getComputedStyle(pm.editorElement, null).getPropertyValue('font-size'));
            color = range.color;
            numParticles = random(pm.getConfig("particles.spawnCount.min"), pm.getConfig("particles.spawnCount.max"));
            _results = [];
            while (numParticles--) {
                pm.particles[pm.particlePointer] = pm.createParticle(left, top, color);
                _results.push(pm.particlePointer = (pm.particlePointer + 1) % pm.getConfig("particles.totalCount.max"));
            }
            return _results;
        },
        createParticle: function (x, y, color) {
            return {
                x: x,
                y: y,
                alpha: 1,
                color: color,
                velocity: {
                    x: -1 + Math.random() * 2,
                    y: -3.5 + Math.random() * 2
                }
            };
        },
        drawParticles: function () {
            var gco, particle, size, _i, _len, _ref;
            if (pm.active) {
                requestAnimationFrame(pm.drawParticles.bind(pm));
            }
            pm.canvas.width = pm.editorElement.offsetWidth + $(pm.editorElement).offset().left;
            pm.canvas.height = pm.editorElement.offsetHeight + $(pm.editorElement).offset().top;
            gco = pm.context.globalCompositeOperation;
            pm.context.globalCompositeOperation = "lighter";
            _ref = pm.particles;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                particle = _ref[_i];
                if (particle.alpha <= 0.1) {
                    continue;
                }
                particle.velocity.y += 0.075;
                particle.x += particle.velocity.x;
                particle.y += particle.velocity.y;
                particle.alpha *= 0.96;
                pm.context.fillStyle = "rgba(" + particle.color.slice(4, -1) + ", " + particle.alpha + ")";
                size = random(pm.getConfig("particles.size.min"), pm.getConfig("particles.size.max"), true);
                pm.context.fillRect(Math.round(particle.x - size / 2), Math.round(particle.y - size / 2), size, size);
            }
            pm.context.globalCompositeOperation = gco;
            return true;
        },
        toggle: function () {
            pm.active = !pm.active;
            pm.particlePointer = 0;
            pm.particles = [];
            
            preferences.set("active", pm.active);
            preferences.save();
            
            return requestAnimationFrame(pm.drawParticles.bind(pm));
        }
    };
    CommandManager.register('Activate Power Mode', 'activate-power-mode', function () {
        pm.toggle();
    });
    KeyBindingManager.addBinding('activate-power-mode', 'Ctrl-Alt-0');
    
    AppInit.htmlReady(function () {
        ExtensionUtils.loadStyleSheet(module, 'styles/activate-power-mode.css');
    });
    
    AppInit.appReady(function () {
        pm.activate();
    });
});