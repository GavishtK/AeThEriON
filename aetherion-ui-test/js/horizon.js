/* =========================================================
   AETHERION — Artificial Horizon (Canvas 2D)
   Military-Grade Flight Instrumentation
   Enhanced with 3D Perspective Transform
   ========================================================= */

var Horizon = {};

(function() {

    var canvas, ctx;
    var W, H, dpr;

    // =====================================================
    // INIT
    // =====================================================

    Horizon.init = function() {
        canvas = document.getElementById("horizonCanvas");
        if (!canvas) return;
        ctx = canvas.getContext("2d");
        dpr = window.devicePixelRatio || 1;

        Horizon.resize();
        AG.registerCallback(Horizon.render, "horizon");

        if (window.ResizeObserver) {
            var ro = new ResizeObserver(function() { Horizon.resize(); });
            ro.observe(canvas.parentElement);
        } else {
            window.addEventListener("resize", Horizon.resize);
        }
    };

    Horizon.resize = function() {
        if (!canvas) return;
        var rect = canvas.parentElement.getBoundingClientRect();
        W = canvas.width = (rect.width - 28) * dpr;
        H = canvas.height = Math.min(420, (rect.width - 28) * 0.84) * dpr;
        canvas.style.width = (W / dpr) + "px";
        canvas.style.height = (H / dpr) + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // =====================================================
    // RENDER
    // =====================================================

    Horizon.render = function() {
        if (AG.currentTab !== "live") return;
        if (!ctx || W === 0 || H === 0) return;

        var roll  = AG.roll;
        var pitch = AG.pitch;
        var cx = W / dpr / 2;
        var cy = H / dpr / 2;
        var scale = dpr;
        var angle = roll * Math.PI / 180;
        var pitchOff = pitch * 2.8;

        // Apply 3D perspective transform to canvas based on roll/pitch
        if (canvas && !Horizon._reducedMotion) {
            var tiltX = Math.max(-8, Math.min(8, pitch * 0.15));
            var tiltZ = Math.max(-8, Math.min(8, roll * 0.12));
            canvas.style.transform = 'perspective(600px) rotateX(' + tiltX + 'deg) rotateZ(' + tiltZ + 'deg)';
        }

        ctx.save();
        ctx.clearRect(0, 0, W / dpr, H / dpr);

        // === BEZEL / OUTER RING ===
        ctx.fillStyle = "#050a06";
        ctx.strokeStyle = "#00330d";
        ctx.lineWidth = 3 / dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(cx, cy) - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-angle);

        // === SKY (gradient) ===
        var skyGrad = ctx.createLinearGradient(-cx * 2, -cy * 2, cx * 2, cy * 2);
        skyGrad.addColorStop(0, "#0a1a2a");
        skyGrad.addColorStop(0.5, "#0f2e4a");
        skyGrad.addColorStop(1, "#0a1a2a");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(-cx * 2, -cy * 2, cx * 4, cy * 2);

        // Sky texture (cloud-like dots)
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.save();
        for (var sx = -cx * 2; sx < cx * 2; sx += 30) {
            for (var sy = -cy * 2; sy < pitchOff; sy += 30) {
                ctx.beginPath();
                ctx.arc(sx + 7, sy + 7, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();

        // === GROUND (gradient with texture) ===
        var groundGrad = ctx.createLinearGradient(-cx * 2, pitchOff, cx * 2, pitchOff + cy * 2);
        groundGrad.addColorStop(0, "#4a3a1a");
        groundGrad.addColorStop(0.5, "#3a2a0d");
        groundGrad.addColorStop(1, "#2a1a04");
        ctx.fillStyle = groundGrad;
        ctx.fillRect(-cx * 2, pitchOff, cx * 4, cy * 2);

        // Ground texture (terrain lines)
        ctx.strokeStyle = "rgba(0,255,65,0.04)";
        ctx.lineWidth = 1 / dpr;
        ctx.save();
        for (var gy = Math.floor(pitchOff); gy < cy * 2; gy += 12) {
            ctx.beginPath();
            ctx.moveTo(-cx * 2, gy);
            ctx.lineTo(cx * 2, gy);
            ctx.stroke();
        }
        ctx.restore();

        // === HORIZON LINE (glow) ===
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 4;
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2 / dpr;
        ctx.beginPath();
        ctx.moveTo(-cx * 2, pitchOff);
        ctx.lineTo(cx * 2, pitchOff);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // === PITCH LADDER ===
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (var i = -90; i <= 90; i += 5) {
            if (i === 0) continue;
            var y = i * 2.8 + pitchOff;
            if (y < -cy * 2 - 20 || y > cy * 2 + 20) continue;

            var isMajor = (i % 10 === 0);
            var hw = isMajor ? Math.min(120, Math.abs(i) + 30) : 50;

            ctx.strokeStyle = i > 0 ? "rgba(0,229,255,0.35)" : "rgba(255,176,0,0.35)";
            ctx.lineWidth = isMajor ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(-hw, y);
            ctx.lineTo(hw, y);
            ctx.stroke();

            if (isMajor) {
                ctx.font = (11 / dpr) + "px 'Courier New', monospace";
                ctx.fillStyle = "rgba(255,255,255,0.65)";
                ctx.fillText(Math.abs(i) + "\u00B0", hw + 32, y);
                ctx.fillText(Math.abs(i) + "\u00B0", -hw - 32, y);

                ctx.strokeStyle = "rgba(255,255,255,0.2)";
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(hw, y - 8);
                ctx.lineTo(hw + 8, y - 8);
                ctx.moveTo(hw, y + 8);
                ctx.lineTo(hw + 8, y + 8);
                ctx.moveTo(-hw, y - 8);
                ctx.lineTo(-hw - 8, y - 8);
                ctx.moveTo(-hw, y + 8);
                ctx.lineTo(-hw - 8, y + 8);
                ctx.stroke();
            }
        }

        // Zero-degree reference (wide bar)
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-140, pitchOff);
        ctx.lineTo(-60, pitchOff);
        ctx.moveTo(60, pitchOff);
        ctx.lineTo(140, pitchOff);
        ctx.stroke();

        ctx.restore();

        // === AIRCRAFT SYMBOL (fixed, centered) ===
        ctx.strokeStyle = "#ffb000";
        ctx.fillStyle = "#ffb000";
        ctx.shadowColor = "#ffb000";
        ctx.shadowBlur = 6;

        ctx.lineWidth = 3 / dpr;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx - 80, cy);
        ctx.lineTo(cx - 20, cy);
        ctx.moveTo(cx + 20, cy);
        ctx.lineTo(cx + 80, cy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy - 22);
        ctx.lineTo(cx - 8, cy - 4);
        ctx.lineTo(cx + 8, cy - 4);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 100, cy + 2);
        ctx.lineTo(cx - 115, cy + 2);
        ctx.moveTo(cx + 115, cy + 2);
        ctx.lineTo(cx + 100, cy + 2);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // === ROLL ARC (top) ===
        Horizon.drawRollArc(cx, cy, roll);

        // === TURN COORDINATOR (bottom-right corner) ===
        Horizon.drawTurnCoordinator(cx, cy, roll, AG.gx, AG.gz);
    };

    // =====================================================
    // ROLL ARC
    // =====================================================

    Horizon.drawRollArc = function(cx, cy, roll) {
        var rx = cx;
        var ry = 55;
        var rr = 48;

        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rx, ry, rr, 0.8, Math.PI - 0.8);
        ctx.stroke();

        var ticks = [-60, -50, -45, -30, -20, -10, 0, 10, 20, 30, 45, 50, 60];
        ctx.font = "10px 'Courier New', monospace";
        ctx.textAlign = "center";

        for (var i = 0; i < ticks.length; i++) {
            var ta = (ticks[i] - 90) * Math.PI / 180;
            var inner = rr - (Math.abs(ticks[i]) >= 50 ? 10 :
                              Math.abs(ticks[i]) >= 30 ? 7 : 5);

            var isMajor = (ticks[i] % 15 === 0);
            ctx.strokeStyle = ticks[i] === 0 ? "#00ff41" :
                              "rgba(0,255,65,0.4)";
            ctx.lineWidth = ticks[i] === 0 ? 2 : (isMajor ? 1.5 : 1);

            ctx.beginPath();
            ctx.moveTo(rx + Math.cos(ta) * inner, ry + Math.sin(ta) * inner);
            ctx.lineTo(rx + Math.cos(ta) * rr, ry + Math.sin(ta) * rr);
            ctx.stroke();

            if (isMajor) {
                ctx.fillStyle = "rgba(255,255,255,0.5)";
                ctx.fillText(
                    String(Math.abs(ticks[i])),
                    rx + Math.cos(ta) * (rr + 16),
                    ry + Math.sin(ta) * (rr + 16) + 3
                );
            }
        }

        ctx.fillStyle = "#00e5ff";
        ctx.beginPath();
        ctx.moveTo(rx - 6, ry - rr + 2);
        ctx.lineTo(rx + 6, ry - rr + 2);
        ctx.lineTo(rx, ry - rr - 10);
        ctx.closePath();
        ctx.fill();

        var pa = (roll - 90) * Math.PI / 180;
        ctx.fillStyle = "#00e5ff";
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(
            rx + Math.cos(pa) * (rr - 1),
            ry + Math.sin(pa) * (rr - 1),
            5, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.shadowBlur = 0;
    };

    // =====================================================
    // TURN COORDINATOR (mini, bottom-right)
    // =====================================================

    Horizon.drawTurnCoordinator = function(cx, cy, roll, gx, gz) {
        var size = 70;
        var bx = cx - size - 12;
        var by = cy + 20;

        ctx.fillStyle = "rgba(8,15,11,0.9)";
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.fillRect(bx, by, size, size);
        ctx.beginPath();
        ctx.rect(bx, by, size, size);
        ctx.stroke();

        var turnRate = Math.sqrt(gx * gx + gz * gz);
        var turnDir = gz > 0 ? 1 : -1;

        ctx.strokeStyle = "#ffb000";
        ctx.fillStyle = "#ffb000";
        ctx.lineWidth = 2;

        var acx = bx + size / 2;
        var acy = by + 20;

        ctx.beginPath();
        ctx.moveTo(acx - 12, acy);
        ctx.lineTo(acx - 4, acy);
        ctx.moveTo(acx + 4, acy);
        ctx.lineTo(acx + 12, acy);
        ctx.stroke();

        var ballX = acx - 16 + turnRate * 20;
        if (turnDir < 0) ballX = acx + 16 - turnRate * 20;

        ctx.fillStyle = "rgba(0,255,65,0.8)";
        ctx.beginPath();
        ctx.arc(ballX, acy + 26, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(0,255,65,0.5)";
        ctx.font = "9px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("TURN", acx, by + size - 4);
    };

})();
