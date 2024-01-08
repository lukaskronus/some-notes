// ==UserScript==
// @name           Change Background Color
// @namespace      Change Background Color
// @description    A script that changes the background color of web pages based on specified conditions.
// @author         RGB
// @include        *.*
// @version        1.6
// ==/UserScript==

(function () {
    var Gr1 = 235; // R value in RGB
    var Gg1 = 235; // G value in RGB
    var Gb1 = 235; // B value in RGB
    var color = "#e3d7a1"; // Background color to change to, default is a color recommended for eyes
    // You can use #f8f3e0 or #f6ecd3 for brighter color

    var Gr, Gg, Gb; // Global variables to record the current tag's RGB values for comparison

    function parseRGB(rgb) {
        var start = rgb.indexOf(",");
        Gr = parseInt(rgb.slice(4, start));

        var end = rgb.indexOf(",", start + 1);
        Gg = parseInt(rgb.slice(start + 1, end));

        Gb = parseInt(rgb.slice(end + 1, rgb.length - 1));
    }

    function changeBackgroundColor(element) {
        var computedColor = document.defaultView.getComputedStyle(element, "").getPropertyValue("background-Color");
        parseRGB(computedColor);
        if (Gr > Gr1 && Gg > Gg1 && Gb > Gb1) {
            element.style.backgroundColor = color;
        }
    }

    // Function to apply background color changes to visible elements
    function applyBackgroundColorToVisible() {
        // Get all visible elements in the viewport
        var visibleElements = document.querySelectorAll(':not([style*="display: none"])');
        visibleElements.forEach(function (element) {
            changeBackgroundColor(element);
        });
    }

    // Apply changes once when the page is initialized
    applyBackgroundColorToVisible();

    // Use Intersection Observer to detect when new elements become visible in the viewport
    var intersectionObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting || entry.intersectionRatio > 0) {
                // When an element becomes visible, apply background color changes
                applyBackgroundColorToVisible();
            }
        });
    }, { threshold: 0.8 }); // Adjust the threshold as needed

    // Configure Intersection Observer to observe the whole document
    intersectionObserver.observe(document.documentElement);

    // Use MutationObserver to monitor changes in specific parts of the DOM
    var mutationObserver = new MutationObserver(function () {
        // When there are changes in the DOM, apply background color changes to visible elements
        applyBackgroundColorToVisible();
    });

    // Configure MutationObserver to monitor changes in specific elements
    var observerConfig = { attributes: true, childList: true, subtree: true };

    // Start MutationObserver
    mutationObserver.observe(document.documentElement, observerConfig);
})();
