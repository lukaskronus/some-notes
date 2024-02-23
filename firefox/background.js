// ==UserScript==
// @name           Change Background Color
// @namespace      Change Background Color
// @description    A brief description of your script
// @author         RGB
// @include        *.*
// @version        1.3
// ==/UserScript==

(function () {
    var Gr1 = 240; // R value in RGB
    var Gg1 = 240; // G value in RGB
    var Gb1 = 240; // B value in RGB
    var color = "#f6ecd3"; // Changed background color
    // There are other options: #d1daca or #d1e0c8 for Eye-protection Color and #c1c1c1 or #cccccc for Night View Color

    var Gr, Gg, Gb; // Global variables to record the current tag's RGB values for comparison

    // Function to decompose the RGB obtained in the format "rgb(255, 255, 255)"
    function decomposeRGB(Grgb) {
        var start = Grgb.indexOf(",");
        Gr = parseInt(Grgb.slice(4, start));

        var start1 = Grgb.indexOf(",", start + 1);
        Gg = parseInt(Grgb.slice(start + 1, start1));

        Gb = parseInt(Grgb.slice(start1 + 1, Grgb.length - 1));
    }

    // Function to apply color changes to a given element
    function applyColorChanges(element) {
        var currentColor = window.getComputedStyle(element).getPropertyValue("background-color");
        decomposeRGB(currentColor);

        if (Gr > Gr1 && Gg > Gg1 && Gb > Gb1) {
            element.style.backgroundColor = color;
        }
    }

    // Function to handle lazy-loaded content
    function handleLazyLoad() {
        var allTags = document.getElementsByTagName("*");

        for (let x = 0; x < allTags.length; x++) {
            try {
                var currentColor = window.getComputedStyle(allTags[x]).getPropertyValue("background-color");
                decomposeRGB(currentColor);

                if (Gr > Gr1 && Gg > Gg1 && Gb > Gb1) {
                    allTags[x].style.backgroundColor = color;
                }
            } catch (err) {
                // Handle potential errors
            }
        }
    }

    // Periodically check for changes to handle lazy-loaded content
    setInterval(handleLazyLoad, 500); // Adjust the interval time (in milliseconds) as needed

    // Apply color changes to the existing content on page load
    handleLazyLoad();
})();
