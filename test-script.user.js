// ==UserScript==
// @name         ScriptFlow Test Script
// @namespace    https://scriptflow.dev
// @version      1.0.0
// @description  Test script to verify ScriptFlow functionality
// @author       ScriptFlow
// @match        *://example.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('[ScriptFlow] Test script running!');
    
    // Test GM API
    GM_setValue('test_key', 'ScriptFlow works!');
    const value = GM_getValue('test_key', 'default');
    console.log('[ScriptFlow] GM API test:', value);
    
    // Test DOM manipulation
    const testDiv = document.createElement('div');
    testDiv.innerHTML = '<h2 style="color: #3b82f6; text-align: center; padding: 20px; background: #1e293b; border-radius: 8px; margin: 20px;">🎉 ScriptFlow is working! 🎉</h2>';
    document.body.appendChild(testDiv);
    
    // Test alert
    setTimeout(() => {
        alert('ScriptFlow Test Script executed successfully!\n\nGM API: ' + value);
    }, 1000);
    
})();