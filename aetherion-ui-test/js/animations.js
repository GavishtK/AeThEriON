/* =========================================================
   AETHERION — Animation Orchestration (GSAP)
   ========================================================= */

var Animations = {};

(function() {

    var reducedMotion = false;
    var gsapLoaded = typeof gsap !== 'undefined';

    // =====================================================
    // INIT
    // =====================================================

    Animations.init = function() {
        var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotion = mq.matches;
        mq.addEventListener('change', function(e) {
            reducedMotion = e.matches;
        });

        if (AG.settings && AG.settings.reducedMotion !== undefined) {
            reducedMotion = AG.settings.reducedMotion;
        }

        Animations.initPanelHover();
        Animations.initButtonPress();
        Animations.initStatusHover();
    };

    // =====================================================
    // PANEL 3D HOVER
    // =====================================================

    Animations.initPanelHover = function() {
        if (reducedMotion) return;

        document.querySelectorAll('.panel').forEach(function(panel) {
            panel.addEventListener('mousemove', function(e) {
                if (reducedMotion) return;
                var rect = panel.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                var centerX = rect.width / 2;
                var centerY = rect.height / 2;
                var rotateX = ((y - centerY) / centerY) * -2;
                var rotateY = ((x - centerX) / centerX) * 2;

                panel.style.transform = 'perspective(1000px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateZ(8px)';
                panel.style.boxShadow = '0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(0,255,65,0.12)';
            });

            panel.addEventListener('mouseleave', function() {
                panel.style.transform = '';
                panel.style.boxShadow = '';
            });
        });
    };

    // =====================================================
    // BUTTON 3D PRESS
    // =====================================================

    Animations.initButtonPress = function() {
        if (reducedMotion) return;

        document.querySelectorAll('.btn').forEach(function(btn) {
            btn.addEventListener('mousedown', function() {
                btn.style.transform = 'translateY(2px) translateZ(-2px)';
                btn.style.boxShadow = 'none';
            });
            btn.addEventListener('mouseup', function() {
                btn.style.transform = '';
                btn.style.boxShadow = '';
            });
            btn.addEventListener('mouseleave', function() {
                btn.style.transform = '';
                btn.style.boxShadow = '';
            });
        });
    };

    // =====================================================
    // STATUS ITEM HOVER
    // =====================================================

    Animations.initStatusHover = function() {
        if (reducedMotion) return;

        document.querySelectorAll('.status-item').forEach(function(item) {
            item.addEventListener('mouseenter', function() {
                item.style.transform = 'translateZ(5px)';
                item.style.transition = 'transform 0.2s ease';
            });
            item.addEventListener('mouseleave', function() {
                item.style.transform = '';
            });
        });
    };

    // =====================================================
    // TAB TRANSITION (GSAP)
    // =====================================================

    Animations.tabIn = function(tabEl) {
        if (reducedMotion || !gsapLoaded) return;

        gsap.fromTo(tabEl,
            { opacity: 0, x: 25, scale: 0.98 },
            {
                duration: 0.35,
                opacity: 1,
                x: 0,
                scale: 1,
                ease: 'power2.out',
                clearProps: 'all'
            }
        );

        var panels = tabEl.querySelectorAll('.panel');
        if (panels.length > 0) {
            Animations.panelEntrance(panels);
        }
    };

    Animations.panelEntrance = function(panels) {
        if (reducedMotion || !gsapLoaded) return;

        gsap.fromTo(panels,
            { y: 25, opacity: 0 },
            {
                duration: 0.5,
                y: 0,
                opacity: 1,
                stagger: 0.08,
                ease: 'power2.out',
                clearProps: 'all'
            }
        );
    };

    // =====================================================
    // TELEMETRY VALUE PULSE
    // =====================================================

    Animations.pulseTelemetry = function(el) {
        if (!el) return;

        if (reducedMotion || !gsapLoaded) {
            el.classList.add('pulse');
            setTimeout(function() { el.classList.remove('pulse'); }, 400);
            return;
        }

        gsap.fromTo(el,
            { scale: 1 },
            { scale: 1.08, duration: 0.15, yoyo: true, repeat: 1, ease: 'power1.inOut' }
        );
    };

    // =====================================================
    // GRAPH REVEAL
    // =====================================================

    Animations.revealGraph = function(canvasEl) {
        if (!canvasEl) return;

        if (reducedMotion || !gsapLoaded) {
            canvasEl.classList.add('active');
            return;
        }

        gsap.fromTo(canvasEl,
            { opacity: 0, rotateX: -8, y: 8 },
            { opacity: 1, rotateX: 0, y: 0, duration: 0.4, ease: 'power2.out',
              onComplete: function() { canvasEl.classList.add('active'); }
            }
        );
    };

    // =====================================================
    // READOUT 3D EFFECT
    // =====================================================

    Animations.readoutEffect = function(el) {
        if (!el) return;

        if (reducedMotion || !gsapLoaded) return;

        gsap.fromTo(el,
            { rotateX: 0 },
            { rotateX: 5, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.inOut' }
        );
    };

    // =====================================================
    // SET REDUCED MOTION
    // =====================================================

    Animations.setReducedMotion = function(flag) {
        reducedMotion = flag;
    };

})();
