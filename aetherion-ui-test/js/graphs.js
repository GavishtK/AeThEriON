/* =========================================================
   AETHERION — Live Telemetry Graphs
   Enhanced with 3D Reveal Animations
   ========================================================= */

var Graphs = {};

(function() {

    var canvases = {};
    var ctx = {};
    var dims = {};

    var graphDefs = {
        roll:   { label: "ROLL",   range: [-45, 45], unit: "\u00B0",  color: "#00ff41", mid: 0,   fields: ["roll"] },
        pitch:  { label: "PITCH",  range: [-45, 45], unit: "\u00B0",  color: "#00e5ff", mid: 0,   fields: ["pitch"] },
        gforce: { label: "G-FORCE", range: [0.5, 2.0], unit: "G", color: "#ffb000", mid: 1.0, fields: ["gForce"] },
        gyro:   { label: "GYRO",   range: [-0.5, 0.5], unit: "rad/s", color: "#ff44ff", mid: 0, fields: ["gx", "gy", "gz"] }
    };

    // =====================================================
    // INIT
    // =====================================================

    Graphs.init = function() {
        var ids = ["graphRoll", "graphPitch", "graphGforce", "graphGyro"];
        ids.forEach(function(id) {
            var c = document.getElementById(id);
            if (c) {
                canvases[id] = c;
                ctx[id] = c.getContext("2d");
                var g = c.getAttribute("data-graph");
                dims[g] = { ctx: ctx[id], canvas: c };
            }
        });

        document.querySelectorAll(".gtab").forEach(function(btn) {
            btn.addEventListener("click", function() {
                document.querySelectorAll(".gtab").forEach(function(b) { b.classList.remove("active"); });
                btn.classList.add("active");

                document.querySelectorAll(".graph-canvas").forEach(function(c) { c.classList.remove("active"); });
                var g = btn.getAttribute("data-graph");
                var target = null;
                ids.forEach(function(id) {
                    if (canvases[id]) {
                        var dg = canvases[id].getAttribute("data-graph");
                        if (dg === g) target = canvases[id];
                    }
                });
                if (target) {
                    if (typeof Animations !== 'undefined') {
                        Animations.revealGraph(target);
                    } else {
                        target.classList.add("active");
                    }
                }
                Graphs.onResize();
            });
        });

        Graphs.onResize();
        requestAnimationFrame(function() { Graphs.onResize(); });
        window.addEventListener("resize", Graphs.onResize);

        AG.registerCallback(Graphs.renderLive, "graph");
    };

    Graphs.onResize = function() {
        Object.keys(dims).forEach(function(key) {
            var d = dims[key];
            if (d && d.canvas) {
                var rect = d.canvas.parentElement.getBoundingClientRect();
                var w = Math.floor(rect.width);
                var h = Math.floor(rect.height);
                d.canvas.width = w;
                d.canvas.height = h;
            }
        });
    };

    // =====================================================
    // RENDER SINGLE GRAPH
    // =====================================================

    Graphs.renderGraph = function(key) {
        var def = graphDefs[key];
        if (!def) return;

        var d = dims[key];
        if (!d || !d.ctx) return;

        var c = d.canvas;
        var w = c.width;
        var h = c.height;
        var context = d.ctx;

        if (w === 0 || h === 0) return;

        context.clearRect(0, 0, w, h);

        context.fillStyle = "#080f0b";
        context.fillRect(0, 0, w, h);

        var [minV, maxV] = def.range;
        var padding = 10;
        var plotX = padding;
        var plotY = padding;
        var plotW = w - padding * 2;
        var plotH = h - padding * 2;

        context.strokeStyle = "rgba(0,255,65,0.08)";
        context.lineWidth = 1;
        context.font = "10px 'Courier New', monospace";
        context.textAlign = "right";
        context.fillStyle = "rgba(0,255,65,0.3)";

        var steps = 5;
        for (var i = 0; i <= steps; i++) {
            var val = minV + (maxV - minV) * (i / steps);
            var y = plotY + plotH - (i / steps) * plotH;

            context.beginPath();
            context.moveTo(plotX, y);
            context.lineTo(plotX + plotW, y);
            context.stroke();

            if (Math.abs(val - def.mid) < 0.01) {
                context.strokeStyle = "rgba(0,255,65,0.2)";
                context.beginPath();
                context.moveTo(plotX, y);
                context.lineTo(plotX + plotW, y);
                context.stroke();
                context.strokeStyle = "rgba(0,255,65,0.08)";
            }

            if (val === Math.round(val)) {
                context.fillText(val + def.unit, plotX - 4, y + 3);
            } else {
                context.fillText(val.toFixed(1) + def.unit, plotX - 4, y + 3);
            }
        }

        context.textAlign = "center";
        context.fillStyle = def.color;
        context.font = "11px 'Courier New', monospace";
        context.fillText(def.label, w / 2, 14);

        context.textAlign = "right";
        context.fillStyle = "rgba(0,255,65,0.3)";
        context.font = "9px 'Courier New', monospace";
        context.fillText("TIME \u2192", plotX + plotW, plotY + plotH + 14);

        var history = AG.history;
        var n = history.length;
        if (n < 2) return;

        context.shadowColor = def.color;
        context.shadowBlur = 8;
        context.lineJoin = "round";
        context.lineCap = "round";

        def.fields.forEach(function(field, fi) {
            var color = fi === 0 ? def.color :
                        fi === 1 ? "#ff66ff" : "#66ccff";

            context.strokeStyle = color;
            context.lineWidth = 1.5;
            context.beginPath();

            var stepX = plotW / Math.max(n - 1, 1);

            for (var i = 0; i < n; i++) {
                var val = history[i][field];
                if (val === undefined || val === null) val = 0;

                var clamped = Math.max(minV, Math.min(maxV, val));
                var y = plotY + plotH - ((clamped - minV) / (maxV - minV)) * plotH;
                var x = plotX + i * stepX;

                if (i === 0) {
                    context.moveTo(x, y);
                } else {
                    context.lineTo(x, y);
                }
            }
            context.stroke();
        });

        context.shadowColor = "transparent";
        context.shadowBlur = 0;
    };

    // =====================================================
    // RENDER ALL (called from main loop)
    // =====================================================

    Graphs.renderLive = function() {
        if (AG.currentTab !== "live") return;

        Object.keys(dims).forEach(function(key) {
            Graphs.renderGraph(key);
        });
    };

})();
