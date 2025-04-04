document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const paramForm = document.getElementById('lut-params');
    const inputs = paramForm.querySelectorAll('input[type="range"], input[type="number"]');
    const resetButton = document.getElementById('reset-params');
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    const aiFetchButton = document.getElementById('ai-fetch-button');
    const aiStatus = document.getElementById('ai-status');
    const generateButton = document.getElementById('generate-lut');
    const generateStatus = document.getElementById('generate-status');
    const downloadLink = document.getElementById('download-link');
    const lutSizeSelect = document.getElementById('lut-size');
    const apiKeyInput = document.getElementById('api-key');
    const saveApiKeyButton = document.getElementById('save-api-key');
    const apiIcon = document.getElementById('api-icon');
    const apiPanel = document.getElementById('api-panel');
    const settingsIcon = document.getElementById('settings-icon');
    const settingsDropdown = document.getElementById('settings-dropdown');

    // --- State ---
    let uploadedImageData = null;
    let uploadedMimeType = null;
    let userApiKey = localStorage.getItem('googleAiApiKey') || '';

    // --- Google AI Config ---
    const GOOGLE_AI_MODEL = 'gemini-1.5-flash-latest'; // Or 'gemini-pro-vision', 'gemini-1.5-pro-latest'
    const GOOGLE_AI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_AI_MODEL}:generateContent`;

    // --- Default Values ---
    const defaultValues = {
        contrast: 1.0, saturation: 1.0, temperature: 0.0, exposure: 0.0,
        highlights: 0.0, shadows: 0.0, whites: 0.0, blacks: 0.0, intensity: 1.0
    };

    // --- Initial Setup ---
    apiKeyInput.value = userApiKey;
    resetParameters();

    // --- Event Listeners ---

    inputs.forEach(input => {
        input.addEventListener('input', handleInputChange);
    });
    resetButton.addEventListener('click', resetParameters);
    imageUpload.addEventListener('change', handleImageUpload);
    aiFetchButton.addEventListener('click', handleAIFetch);
    generateButton.addEventListener('click', handleGenerateLUT);
    apiIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.classList.remove('show');
        apiPanel.classList.toggle('show');
    });
    settingsIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        apiPanel.classList.remove('show');
        settingsDropdown.classList.toggle('show');
    });
    saveApiKeyButton.addEventListener('click', () => {
        userApiKey = apiKeyInput.value;
        if (userApiKey) {
            localStorage.setItem('googleAiApiKey', userApiKey);
            alert("API Key saved locally for this browser session.");
            // If an image is already loaded, re-enable the AI button
             if (uploadedImageData) {
                aiFetchButton.disabled = false;
                 aiStatus.textContent = 'Image loaded. Ready for AI analysis.';
             }
        } else {
            localStorage.removeItem('googleAiApiKey');
            alert("API Key cleared.");
            aiFetchButton.disabled = true; // Disable AI button if key removed
            if (uploadedImageData) {
                aiStatus.textContent = 'Image loaded. API Key required for AI analysis.';
            }
        }
        apiPanel.classList.remove('show');
    });
    document.addEventListener('click', (e) => {
        if (!apiPanel.contains(e.target) && !apiIcon.contains(e.target)) {
            apiPanel.classList.remove('show');
        }
        if (!settingsDropdown.contains(e.target) && !settingsIcon.contains(e.target)) {
            settingsDropdown.classList.remove('show');
        }
    });


    // --- Functions ---

    function handleInputChange(event) {
        const target = event.target;
        const name = target.name;
        const value = parseFloat(target.value);
        let linkedInput;
        if (target.type === 'range') {
            linkedInput = document.getElementById(`${name}-val`);
        } else if (target.type === 'number') {
            linkedInput = document.getElementById(name);
        }
        if (linkedInput) {
            linkedInput.value = value;
        }
    }

    function resetParameters() {
        for (const key in defaultValues) {
            const slider = document.getElementById(key);
            const numberInput = document.getElementById(`${key}-val`);
            if (slider) slider.value = defaultValues[key];
            if (numberInput) numberInput.value = defaultValues[key];
        }
        generateStatus.textContent = '';
        // Don't clear AI status on reset, keep info about image/key state
        // aiStatus.textContent = '';
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        uploadedImageData = null;
        uploadedMimeType = null;
        aiFetchButton.disabled = true; // Disable initially

        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
                previewPlaceholder.style.display = 'none';
                uploadedImageData = e.target.result;
                uploadedMimeType = file.type;
                aiFetchButton.disabled = !userApiKey; // Enable only if key exists
                 if (userApiKey) {
                    aiStatus.textContent = 'Image loaded. Ready for AI analysis.';
                 } else {
                     aiStatus.textContent = 'Image loaded. API Key required for AI analysis.';
                 }
            }
            reader.onerror = (err) => {
                 console.error("FileReader error:", err);
                 aiStatus.textContent = 'Error reading image file.';
                 imagePreview.style.display = 'none';
                 previewPlaceholder.style.display = 'block';
                 uploadedImageData = null;
                 uploadedMimeType = null;
                 aiFetchButton.disabled = true;
            }
            reader.readAsDataURL(file);
        } else {
            imagePreview.style.display = 'none';
            previewPlaceholder.style.display = 'block';
            aiStatus.textContent = 'Please select a valid image file.';
            uploadedImageData = null;
            uploadedMimeType = null;
            aiFetchButton.disabled = true;
        }
    }

    async function handleAIFetch() {
        if (!uploadedImageData || !uploadedMimeType) {
            aiStatus.textContent = 'Error: No valid image uploaded.';
            return;
        }
        if (!userApiKey) {
            aiStatus.textContent = 'Error: Google AI API Key is missing. Please enter it in the API settings (key icon).';
            apiPanel.classList.add('show');
            return;
        }

        const base64Data = uploadedImageData.split(',')[1];
        if (!base64Data) {
             aiStatus.textContent = 'Error: Could not extract image data.';
             return;
        }

        aiStatus.textContent = 'Analyzing image with Google AI...';
        aiFetchButton.disabled = true;
        aiFetchButton.textContent = 'Analyzing...';

        try {
            const aiParams = await callGoogleAI(base64Data, uploadedMimeType, userApiKey);

            let paramsApplied = 0;
            for (const key in aiParams) {
                if (defaultValues.hasOwnProperty(key)) {
                    const slider = document.getElementById(key);
                    const numberInput = document.getElementById(`${key}-val`);
                    let value = parseFloat(aiParams[key]);

                    if (isNaN(value)) {
                        console.warn(`AI returned non-numeric value for ${key}:`, aiParams[key]);
                        continue;
                    }

                    if (slider) {
                        const min = parseFloat(slider.min);
                        const max = parseFloat(slider.max);
                        value = Math.max(min, Math.min(max, value));
                        slider.value = value;
                    }
                    if (numberInput) {
                         const min = parseFloat(numberInput.min);
                        const max = parseFloat(numberInput.max);
                        value = Math.max(min, Math.min(max, value));
                        numberInput.value = value;
                    }
                    paramsApplied++;
                } else {
                     console.warn(`AI returned unexpected parameter: ${key}`);
                }
            }
            if (paramsApplied > 0) {
                 aiStatus.textContent = 'AI parameters applied successfully!';
            } else {
                 aiStatus.textContent = 'AI analysis complete, but no valid parameters were returned or applied.';
                 console.warn("Received AI response, but couldn't apply parameters. Raw response:", aiParams);
            }

        } catch (error) {
            console.error("Google AI Fetch Error:", error);
            aiStatus.textContent = `Error: ${error.message}. Check console & API Key.`;
             // Add specific messages based on error type if needed (e.g., network, API status codes)
            if (error.message.includes('400')) aiStatus.textContent += ' (Bad request - check image/prompt)';
            else if (error.message.includes('403')) aiStatus.textContent += ' (Permission denied - check API Key)';
            else if (error.message.includes('429')) aiStatus.textContent += ' (Quota exceeded)';
            else if (error.message.includes('Failed to fetch')) aiStatus.textContent += ' (Network error)';
            else if (error.message.includes('not valid JSON')) aiStatus.textContent += ' (AI response format error)';

        } finally {
            aiFetchButton.disabled = !uploadedImageData || !userApiKey;
            aiFetchButton.textContent = 'Get Values via AI';
        }
    }

    // =========================================================================
    // ===== GOOGLE AI API CALL FUNCTION (with Robust Parsing) =================
    // =========================================================================
    async function callGoogleAI(base64ImageData, mimeType, apiKey) {
        const url = `${GOOGLE_AI_API_ENDPOINT}?key=${apiKey}`;

        // --- **STRONGER** Prompt Engineering ---
        const promptText = `
Analyze the color grading style of the provided image. Your goal is to estimate the parameters needed to transform a neutral image to look like this one using the following controls.

Provide **ONLY** a valid JSON object containing estimations for the following parameters. Use the specified keys and stay within the typical numerical ranges:

*   "contrast": number (Range: 0.5 to 1.5, 1.0 is neutral)
*   "saturation": number (Range: 0.0 to 2.0, 1.0 is neutral)
*   "temperature": number (Range: -1.0 to 1.0, 0.0 is neutral, + warm, - cool)
*   "exposure": number (Range: -2.0 to 2.0, 0.0 is neutral)
*   "highlights": number (Range: -1.0 to 1.0, 0.0 is neutral, + lift, - lower)
*   "shadows": number (Range: -1.0 to 1.0, 0.0 is neutral, + lift, - lower)
*   "whites": number (Range: -0.5 to 0.5, 0.0 is neutral, + brighter/clip, - pull down)
*   "blacks": number (Range: -0.5 to 0.5, 0.0 is neutral, + lift, - crush)
*   "intensity": number (Range: 0.5 to 1.5, 1.0 is neutral overall strength)

**CRITICAL INSTRUCTION:** Your entire response MUST be ONLY the JSON object itself. Start directly with '{' and end directly with '}'. Do NOT include any introductory text, descriptive text, explanations, apologies, markdown formatting (like \`\`\`json), code fences, or any characters outside the single JSON object. Failure to comply will result in an unusable response.

Example of a *perfect* response (literally only this):
{"contrast": 1.15, "saturation": 1.3, "temperature": 0.1, "exposure": -0.1, "highlights": -0.2, "shadows": 0.15, "whites": 0.05, "blacks": -0.05, "intensity": 1.0}
`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: promptText },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64ImageData
                            }
                        }
                    ]
                }
            ],
             generationConfig: {
                // temperature: 0.2, // Lower value can sometimes help stick to format
                maxOutputTokens: 512, // Limit output size
                response_mime_type: "application/json", // Explicitly request JSON output if model supports it (Gemini 1.5 does)
             },
             // Default safety settings are usually fine, adjust if needed
            // safetySettings: [ { category: "HARM_CATEGORY_...", threshold: "BLOCK_MEDIUM_AND_ABOVE" } ]
        };

        console.log("Sending request to Google AI:", JSON.stringify(requestBody, null, 2)); // Log the request body

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
             let errorBodyText = await response.text(); // Get raw error text
             let errorJson = null;
             try { errorJson = JSON.parse(errorBodyText); } catch (e) {} // Try parsing as JSON
             console.error(`Google AI API Error: ${response.status} ${response.statusText}`);
             console.error("API Error Response Body:", errorJson || errorBodyText); // Log parsed JSON or raw text
             throw new Error(`Google AI API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Raw Google AI Response Data:", data); // Log the full response structure

        // --- **MORE ROBUST** Response Parsing ---
        try {
            if (data.candidates && data.candidates.length > 0 &&
                data.candidates[0].content && data.candidates[0].content.parts &&
                data.candidates[0].content.parts.length > 0)
            {
                // With response_mime_type: "application/json", the result *should* be in parts[0].text as a parsable string
                // or potentially directly as a structured object in parts[0] if the model supports it fully.
                // Let's prioritize checking if parts[0] itself is structured data, then fallback to text.

                const part = data.candidates[0].content.parts[0];

                if (part.text) {
                    // Primarily expect text containing JSON string
                    let aiText = part.text;
                    console.log("Raw text from AI candidate:", aiText);

                    // 1. Attempt to find JSON block using braces (robust against surrounding text)
                    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
                    if (jsonMatch && jsonMatch[0]) {
                        const potentialJson = jsonMatch[0];
                        console.log("Attempting to parse extracted JSON block:", potentialJson);
                        try {
                            return JSON.parse(potentialJson); // Success!
                        } catch (e) {
                            console.warn("Parsing extracted JSON block failed, trying cleaned full text.", e);
                            // Fall through to cleaning the whole text
                        }
                    }

                    // 2. Fallback: Clean common markdown/text and parse the whole string
                    console.log("Falling back to cleaning the full AI text.");
                    const cleanedText = aiText
                        .replace(/^```json\s*/, '') // Remove ```json at the start
                        .replace(/\s*```$/, '')     // Remove ``` at the end
                        .trim();                     // Trim whitespace

                    if (cleanedText.startsWith("{") && cleanedText.endsWith("}")) {
                         console.log("Attempting to parse cleaned full text:", cleanedText);
                         return JSON.parse(cleanedText); // Parse the cleaned string
                     } else {
                         console.error("Cleaned text doesn't look like JSON:", cleanedText);
                         throw new Error("AI response text does not appear to be a valid JSON object after cleaning.");
                     }

                } else {
                     // If no 'text' field, maybe the model returned structured data directly?
                     // This part is speculative and depends on exact API behavior if response_mime_type modifies the structure.
                     console.warn("AI response part did not contain 'text'. Inspect the part structure:", part);
                     // If 'part' itself looks like our target object, try returning it.
                     // You might need to adjust this based on observed API behavior.
                     if (typeof part === 'object' && part !== null && defaultValues.hasOwnProperty(Object.keys(part)[0])) {
                         console.log("Attempting to use the response part directly as structured data.");
                         return part;
                     }
                     throw new Error("AI response part missing 'text' and doesn't appear structured.");
                }

            } else {
                 // Handle cases where the response structure is unexpected, or content filter blocked
                 let reason = "Unexpected response structure";
                 if (data.candidates && data.candidates[0].finishReason && data.candidates[0].finishReason !== 'STOP') {
                     reason = `Generation stopped: ${data.candidates[0].finishReason}`;
                     if (data.candidates[0].safetyRatings) {
                         reason += ` (Safety: ${JSON.stringify(data.candidates[0].safetyRatings)})`;
                     }
                 } else if (data.promptFeedback && data.promptFeedback.blockReason) {
                    reason = `Prompt blocked: ${data.promptFeedback.blockReason}`;
                 }
                 console.error("Invalid AI Response Structure or Blocked:", data);
                 throw new Error(`AI processing failed: ${reason}. Check console.`);
            }
        } catch (parseError) {
            console.error("Failed to parse or process AI response JSON:", parseError);
            console.error("Raw text (if available):", data?.candidates?.[0]?.content?.parts?.[0]?.text);
            throw new Error("AI response was not valid JSON or processing failed.");
        }
    }
    // =========================================================================
    // ===== END GOOGLE AI API CALL FUNCTION ===================================
    // =========================================================================


    function handleGenerateLUT() {
        generateStatus.textContent = 'Generating LUT...';
        generateButton.disabled = true;
        setTimeout(() => {
            try {
                const params = getParameters();
                const lutSize = parseInt(lutSizeSelect.value, 10);
                const lutString = generateLUTString(params, lutSize);
                triggerDownload(lutString, `generated_lut_${lutSize}x${lutSize}.cube`);
                generateStatus.textContent = `LUT (${lutSize}x${lutSize}) generated successfully!`;
            } catch (error) {
                console.error("LUT Generation Error:", error);
                generateStatus.textContent = `Error generating LUT: ${error.message}`;
            } finally {
                generateButton.disabled = false;
            }
        }, 50);
    }

    function getParameters() {
        const params = {};
        const currentInputs = paramForm.querySelectorAll('input[type="range"]');
        currentInputs.forEach(input => {
            params[input.name] = parseFloat(input.value);
        });
        return params;
    }

    // --- LUT Generation Core Logic ---
    function generateLUTString(params, size) {
        let lut = `TITLE "Generated LUT via Web Tool (Google AI Assist)"\n`;
        lut += `LUT_3D_SIZE ${size}\n`;
        lut += `DOMAIN_MIN 0.0 0.0 0.0\n`;
        lut += `DOMAIN_MAX 1.0 1.0 1.0\n\n`;
        const step = 1.0 / (size - 1);
        for (let b = 0; b < size; b++) {
            for (let g = 0; g < size; g++) {
                for (let r = 0; r < size; r++) {
                    let R = r * step; let G = g * step; let B = b * step;
                    [R, G, B] = applyExposure(R, G, B, params.exposure);
                    [R, G, B] = applyTemperature(R, G, B, params.temperature);
                    [R, G, B] = applyContrast(R, G, B, params.contrast);
                    [R, G, B] = applyHighlightsShadows(R, G, B, params.highlights, params.shadows);
                    [R, G, B] = applyBlacksWhites(R, G, B, params.blacks, params.whites);
                    [R, G, B] = applySaturation(R, G, B, params.saturation);
                    [R, G, B] = applyIntensity(R, G, B, params.intensity);
                    R = Math.max(0.0, Math.min(1.0, R)); G = Math.max(0.0, Math.min(1.0, G)); B = Math.max(0.0, Math.min(1.0, B));
                    lut += `${R.toFixed(6)} ${G.toFixed(6)} ${B.toFixed(6)}\n`;
                }
            }
        }
        return lut;
    }

    // --- Transformation Functions (Simplified) ---
    function clamp(value) { return Math.max(0.0, Math.min(1.0, value)); }
    function applyExposure(r, g, b, exposure) { const factor = Math.pow(2, exposure); return [r * factor, g * factor, b * factor]; }
    function applyContrast(r, g, b, contrast) { return [(r - 0.5) * contrast + 0.5, (g - 0.5) * contrast + 0.5, (b - 0.5) * contrast + 0.5]; }
    function applySaturation(r, g, b, saturation) { const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; return [lum + saturation * (r - lum), lum + saturation * (g - lum), lum + saturation * (b - lum)]; }
    function applyTemperature(r, g, b, temperature) { const rFactor = 1.0 + (0.1 * temperature); const bFactor = 1.0 - (0.1 * temperature); return [clamp(r * rFactor), g , clamp(b * bFactor)]; } // Added clamp here too
    function applyHighlightsShadows(r, g, b, highlights, shadows) { const shadowAdjust = Math.pow(0.5, -shadows); const highlightAdjust = Math.pow(0.5, highlights); return [1.0 - Math.pow(1.0 - clamp(Math.pow(r, shadowAdjust)), highlightAdjust), 1.0 - Math.pow(1.0 - clamp(Math.pow(g, shadowAdjust)), highlightAdjust), 1.0 - Math.pow(1.0 - clamp(Math.pow(b, shadowAdjust)), highlightAdjust)]; } // Clamping intermediate results
    function applyBlacksWhites(r, g, b, blacks, whites) { const blackPoint = blacks * 0.5; const whitePoint = 1.0 + whites * 0.5; if (Math.abs(whitePoint - blackPoint) < 1e-6) return [0.5, 0.5, 0.5]; const scale = 1.0 / (whitePoint - blackPoint); const apply = (val) => (val - blackPoint) * scale; return [apply(r), apply(g), apply(b)]; }
    function applyIntensity(r, g, b, intensity) { return [r * intensity, g * intensity, b * intensity]; }

    // --- Utility ---
    function triggerDownload(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.click();
        setTimeout(() => { URL.revokeObjectURL(url); downloadLink.href = '#'; }, 100);
    }

}); // End DOMContentLoaded