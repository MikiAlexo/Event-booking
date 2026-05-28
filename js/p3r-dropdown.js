/**
 * p3r-dropdown.js
 * Converts native <select> elements into high-contrast, keyboard-accessible
 * Persona 3 Reload style custom dropdown lists.
 */

(function () {
    'use strict';

    function initP3RDropdowns() {
        const selects = document.querySelectorAll('select.input');
        selects.forEach(select => {
            if (select.dataset.p3rInitialized) return;
            createP3RDropdown(select);
        });
    }

    function createP3RDropdown(select) {
        select.style.display = 'none';
        select.dataset.p3rInitialized = 'true';

        // Container
        const container = document.createElement('div');
        container.className = 'p3r-dropdown-container';
        container.tabIndex = 0;

        // Trigger
        const trigger = document.createElement('div');
        trigger.className = 'p3r-dropdown-trigger';

        const label = document.createElement('span');
        label.className = 'p3r-dropdown-trigger-label';
        
        const activeOption = select.options[select.selectedIndex];
        label.textContent = activeOption ? activeOption.textContent : '';

        // Dropdown Arrow SVG - sharp geometric flat pointer
        const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        arrowSvg.setAttribute('class', 'p3r-dropdown-arrow');
        arrowSvg.setAttribute('viewBox', '0 0 24 24');
        arrowSvg.setAttribute('fill', 'none');
        arrowSvg.setAttribute('stroke', 'currentColor');
        arrowSvg.setAttribute('stroke-width', '3');
        
        const arrowPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrowPolygon.setAttribute('points', '6 9 12 15 18 9');
        arrowSvg.appendChild(arrowPolygon);

        trigger.appendChild(label);
        trigger.appendChild(arrowSvg);
        container.appendChild(trigger);

        // Options Panel
        const optionsPanel = document.createElement('div');
        optionsPanel.className = 'p3r-dropdown-options hidden';

        // Options List Array
        const customOptions = [];

        Array.from(select.options).forEach((opt, idx) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'p3r-dropdown-option';
            optionDiv.dataset.value = opt.value;
            optionDiv.dataset.index = idx;

            const textSpan = document.createElement('span');
            textSpan.textContent = opt.textContent;
            optionDiv.appendChild(textSpan);

            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                selectOption(idx);
                closeDropdown();
            });

            optionsPanel.appendChild(optionDiv);
            customOptions.push(optionDiv);
        });

        container.appendChild(optionsPanel);
        select.parentNode.insertBefore(container, select.nextSibling);

        let highlightedIndex = -1;

        // Toggle Open/Close
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (optionsPanel.classList.contains('hidden')) {
                openDropdown();
            } else {
                closeDropdown();
            }
        });

        // Close on outside click
        document.addEventListener('click', () => {
            closeDropdown();
        });

        // Keyboard navigation
        container.addEventListener('keydown', (e) => {
            const isOpen = !optionsPanel.classList.contains('hidden');

            switch (e.key) {
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    if (!isOpen) {
                        openDropdown();
                    } else if (highlightedIndex >= 0) {
                        selectOption(highlightedIndex);
                        closeDropdown();
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (!isOpen) {
                        openDropdown();
                    } else {
                        highlight(highlightedIndex + 1);
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (!isOpen) {
                        openDropdown();
                    } else {
                        highlight(highlightedIndex - 1);
                    }
                    break;
                case 'Escape':
                case 'Tab':
                    if (isOpen) {
                        closeDropdown();
                        if (e.key === 'Escape') e.preventDefault();
                    }
                    break;
            }
        });

        function openDropdown() {
            // Close all other dropdowns
            document.querySelectorAll('.p3r-dropdown-options').forEach(panel => {
                panel.classList.add('hidden');
                panel.parentNode.classList.remove('open');
            });

            optionsPanel.classList.remove('hidden');
            container.classList.add('open');
            highlightedIndex = select.selectedIndex;
            highlight(highlightedIndex);
        }

        function closeDropdown() {
            optionsPanel.classList.add('hidden');
            container.classList.remove('open');
            highlightedIndex = -1;
            customOptions.forEach(opt => opt.classList.remove('highlighted'));
        }

        function selectOption(index) {
            select.selectedIndex = index;
            label.textContent = select.options[index].textContent;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function highlight(index) {
            if (index < 0) index = 0;
            if (index >= customOptions.length) index = customOptions.length - 1;

            highlightedIndex = index;
            customOptions.forEach((opt, idx) => {
                if (idx === index) {
                    opt.classList.add('highlighted');
                    // Scroll into view if needed
                    opt.scrollIntoView({ block: 'nearest' });
                } else {
                    opt.classList.remove('highlighted');
                }
            });
        }

        // Keep dropdown trigger updated if native select changed externally
        const observer = new MutationObserver(() => {
            const currentIdx = select.selectedIndex;
            if (currentIdx >= 0 && select.options[currentIdx]) {
                label.textContent = select.options[currentIdx].textContent;
            }
        });
        observer.observe(select, { attributes: true, childList: true, subtree: true });
        
        // Also listen to change events to update label
        select.addEventListener('change', () => {
            const currentIdx = select.selectedIndex;
            if (currentIdx >= 0 && select.options[currentIdx]) {
                label.textContent = select.options[currentIdx].textContent;
            }
        });
    }

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initP3RDropdowns);
    } else {
        initP3RDropdowns();
    }

    // Export to global scope for dynamic components initialization
    window.initP3RDropdowns = initP3RDropdowns;

})();
