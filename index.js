import {
    name2,
    eventSource,
    event_types,
    isStreamingEnabled,
    saveSettingsDebounced,
} from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { selected_group } from '../../../group-chats.js';
import { t } from '../../../i18n.js';

const MODULE = 'typing_indicator';
const legacyIndicatorTemplate = document.getElementById('typing_indicator_template');

/**
 * @typedef {Object} Theme
 * @property {string} css - 主题的 CSS 内容。
 */

/**
 * @typedef {Object} TypingIndicatorSettings
 * @property {boolean} enabled
 * @property {boolean} streaming
 * @property {boolean} showCharName
 * @property {boolean} animationEnabled - 是否启用末尾的...动画。
 * @property {string} fontColor
 * @property {string} customText
 * @property {Object.<string, Theme>} themes
 * @property {string} activeTheme
 */

/**
 * @type {TypingIndicatorSettings}
 */
const defaultSettings = {
    enabled: false,
    streaming: false,
    showCharName: false,
    animationEnabled: true,
    fontColor: '',
    customText: '正在输入',
    activeTheme: '默认',
    themes: {
        '默认': {
            css: '/* 默认主题：不应用额外样式。 */',
        },
        '渐变脉冲': {
            css: `
#typing_indicator .typing-ellipsis { display: none; }
#typing_indicator div.typing-indicator-text {
    font-weight: bold;
    background: linear-gradient(90deg, #ff00de, #00f2ff, #ff00de);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: gradient-pulse 3s ease-in-out infinite;
}
@keyframes gradient-pulse {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}
            `,
        },
    },
};

/**
 * 获取此扩展的设置。
 */
function getSettings() {
    if (extension_settings[MODULE] === undefined) {
        extension_settings[MODULE] = structuredClone(defaultSettings);
    }
    for (const key in defaultSettings) {
        if (extension_settings[MODULE][key] === undefined) {
            extension_settings[MODULE][key] = defaultSettings[key];
        }
    }
    return extension_settings[MODULE];
}

/**
 * 应用指定主题的 CSS。
 */
function applyTheme(themeName) {
    const settings = getSettings();
    const theme = settings.themes[themeName];
    if (!theme) {
        console.warn(`正在输入中…：未找到主题 "${themeName}"。`);
        return;
    }
    let styleTag = document.getElementById('typing-indicator-theme-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'typing-indicator-theme-style';
        document.head.appendChild(styleTag);
    }
    styleTag.textContent = theme.css;
}

/**
 * 将扩展所需的全局 CSS 注入到文档头部。
 */
function injectGlobalStyles() {
    const css = `
        /* 核心指示器样式修复 */
        #typing_indicator.typing_indicator {
            opacity: 1 !important; /* 强制覆盖主机应用可能存在的透明度样式，以修复不透明CSS仍然半透明的问题。 */
        }

        /* 省略号动画 */
        .typing-ellipsis::after {
            display: inline-block;
            animation: ellipsis-animation 1.4s infinite;
            content: '.';
            width: 1.2em; /* 预留足够空间防止布局抖动 */
            text-align: left;
            vertical-align: bottom;
        }
        @keyframes ellipsis-animation {
            0% { content: '.'; }
            33% { content: '..'; }
            66%, 100% { content: '...'; }
        }

        /* 字体颜色选择器 UI */
        .ti_color_picker_wrapper {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 8px 0;
            padding: 5px 10px;
            background-color: var(--background_panel);
            border-radius: 8px;
        }
        .ti_color_picker_wrapper > span {
            font-weight: bold;
        }
        .ti_color_input_container {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .ti_color_input_container input[type="color"] {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            width: 28px;
            height: 28px;
            padding: 0;
            border: 1px solid var(--border_color);
            border-radius: 6px;
            background-color: transparent;
            cursor: pointer;
        }
        .ti_color_input_container input[type="color"]::-webkit-color-swatch-wrapper {
            padding: 0;
        }
        .ti_color_input_container input[type="color"]::-webkit-color-swatch {
            border: none;
            border-radius: 4px;
        }
        .ti_color_input_container input[type="color"]::-moz-color-swatch {
            border: none;
            border-radius: 4px;
        }
        .ti_reset_color_btn {
            background: none;
            border: none;
            color: var(--text_color_secondary);
            cursor: pointer;
            font-size: 1em;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .ti_reset_color_btn:hover {
            color: var(--text_color_attention);
        }
    `;
    let styleTag = document.getElementById('typing-indicator-global-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'typing-indicator-global-style';
        styleTag.textContent = css;
        document.head.appendChild(styleTag);
    }
}


/**
 * 绘制此扩展的设置界面。
 */
function addExtensionSettings(settings) {
    const settingsContainer = document.getElementById('typing_indicator_container') ?? document.getElementById('extensions_settings');
    if (!settingsContainer) return;

    const inlineDrawer = document.createElement('div');
    inlineDrawer.classList.add('inline-drawer');
    settingsContainer.append(inlineDrawer);

    const inlineDrawerToggle = document.createElement('div');
    inlineDrawerToggle.classList.add('inline-drawer-toggle', 'inline-drawer-header');
    const extensionName = document.createElement('b');
    extensionName.textContent = t`正在输入中…`;
    const inlineDrawerIcon = document.createElement('div');
    inlineDrawerIcon.classList.add('inline-drawer-icon', 'fa-solid', 'fa-circle-chevron-down', 'down');
    inlineDrawerToggle.append(extensionName, inlineDrawerIcon);

    const inlineDrawerContent = document.createElement('div');
    inlineDrawerContent.classList.add('inline-drawer-content');
    inlineDrawer.append(inlineDrawerToggle, inlineDrawerContent);

    // 刷新指示器（如果可见）的辅助函数
    const refreshIndicator = () => {
        const indicator = document.getElementById('typing_indicator');
        if (indicator) {
            showTypingIndicator('refresh', null, false);
        }
    };

    // 启用
    const enabledCheckboxLabel = document.createElement('label');
    enabledCheckboxLabel.classList.add('checkbox_label');
    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.checked = settings.enabled;
    enabledCheckbox.addEventListener('change', () => {
        settings.enabled = enabledCheckbox.checked;
        saveSettingsDebounced();
    });
    const enabledCheckboxText = document.createElement('span');
    enabledCheckboxText.textContent = t`启用`;
    enabledCheckboxLabel.append(enabledCheckbox, enabledCheckboxText);
    inlineDrawerContent.append(enabledCheckboxLabel);

    // 流式传输时显示
    const showIfStreamingCheckboxLabel = document.createElement('label');
    showIfStreamingCheckboxLabel.classList.add('checkbox_label');
    const showIfStreamingCheckbox = document.createElement('input');
    showIfStreamingCheckbox.type = 'checkbox';
    showIfStreamingCheckbox.checked = settings.streaming;
    showIfStreamingCheckbox.addEventListener('change', () => {
        settings.streaming = showIfStreamingCheckbox.checked;
        saveSettingsDebounced();
    });
    const showIfStreamingCheckboxText = document.createElement('span');
    showIfStreamingCheckboxText.textContent = t`流式传输时显示`;
    showIfStreamingCheckboxLabel.append(showIfStreamingCheckbox, showIfStreamingCheckboxText);
    inlineDrawerContent.append(showIfStreamingCheckboxLabel);

    // 启用动画
    const animationEnabledCheckboxLabel = document.createElement('label');
    animationEnabledCheckboxLabel.classList.add('checkbox_label');
    const animationEnabledCheckbox = document.createElement('input');
    animationEnabledCheckbox.type = 'checkbox';
    animationEnabledCheckbox.checked = settings.animationEnabled;
    animationEnabledCheckbox.addEventListener('change', () => {
        settings.animationEnabled = animationEnabledCheckbox.checked;
        saveSettingsDebounced();
        refreshIndicator();
    });
    const animationEnabledCheckboxText = document.createElement('span');
    animationEnabledCheckboxText.textContent = t`启用动画`;
    animationEnabledCheckboxLabel.append(animationEnabledCheckbox, animationEnabledCheckboxText);
    inlineDrawerContent.append(animationEnabledCheckboxLabel);

    // 美化后的字体颜色选择器
    const colorPickerWrapper = document.createElement('div');
    colorPickerWrapper.className = 'ti_color_picker_wrapper';
    const colorPickerTextLabel = document.createElement('span');
    colorPickerTextLabel.textContent = t`字体颜色`;
    const colorInputContainer = document.createElement('div');
    colorInputContainer.className = 'ti_color_input_container';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = settings.fontColor || '#ffffff';
    colorPicker.addEventListener('change', () => {
        settings.fontColor = colorPicker.value;
        saveSettingsDebounced();
        refreshIndicator();
    });
    const resetButton = document.createElement('button');
    resetButton.className = 'ti_reset_color_btn';
    resetButton.title = t`重置`;
    resetButton.innerHTML = '<i class="fa-solid fa-arrow-rotate-left"></i>';
    resetButton.addEventListener('click', () => {
        settings.fontColor = '';
        colorPicker.value = '#ffffff';
        saveSettingsDebounced();
        refreshIndicator();
    });
    colorInputContainer.append(colorPicker, resetButton);
    colorPickerWrapper.append(colorPickerTextLabel, colorInputContainer);
    inlineDrawerContent.append(colorPickerWrapper);

    // 自定义内容区域
    const customContentContainer = document.createElement('div');
    customContentContainer.style.marginTop = '10px';

    // 显示角色名称复选框
    const showNameCheckboxLabel = document.createElement('label');
    showNameCheckboxLabel.classList.add('checkbox_label');
    const showNameCheckbox = document.createElement('input');
    showNameCheckbox.type = 'checkbox';
    showNameCheckbox.checked = settings.showCharName;
    showNameCheckbox.addEventListener('change', () => {
        settings.showCharName = showNameCheckbox.checked;
        saveSettingsDebounced();
        refreshIndicator();
    });
    const showNameCheckboxText = document.createElement('span');
    showNameCheckboxText.textContent = t`显示角色名称`;
    showNameCheckboxLabel.append(showNameCheckbox, showNameCheckboxText);
    customContentContainer.append(showNameCheckboxLabel);

    // 文字内容
    const customTextLabel = document.createElement('label');
    customTextLabel.textContent = t`自定义内容：`;
    customTextLabel.style.display = 'block';
    const customTextInput = document.createElement('input');
    customTextInput.type = 'text';
    customTextInput.value = settings.customText;
    customTextInput.placeholder = t`输入显示的文字`;
    customTextInput.style.width = '80%';
    customTextInput.addEventListener('input', () => {
        settings.customText = customTextInput.value;
        saveSettingsDebounced();
        refreshIndicator();
    });

    const placeholderHint = document.createElement('small');
    placeholderHint.textContent = t`使用 {char} 作为角色名称的占位符。`;
    placeholderHint.style.display = 'block';
    placeholderHint.style.marginTop = '4px';
    placeholderHint.style.color = 'var(--text_color_secondary)';

    customContentContainer.append(customTextLabel, customTextInput, placeholderHint);
    inlineDrawerContent.append(customContentContainer);

    // 主题管理部分
    const divider = document.createElement('hr');
    inlineDrawerContent.append(divider);

    const themeSelectorLabel = document.createElement('label');
    themeSelectorLabel.textContent = t`外观主题：`;
    const themeSelector = document.createElement('select');
    const populateThemes = () => {
        themeSelector.innerHTML = '';
        Object.keys(settings.themes).forEach(themeName => {
            const option = document.createElement('option');
            option.value = themeName;
            option.textContent = themeName;
            themeSelector.appendChild(option);
        });
        themeSelector.value = settings.activeTheme;
    };
    populateThemes();
    inlineDrawerContent.append(themeSelectorLabel, themeSelector);

    const cssEditorLabel = document.createElement('label');
    cssEditorLabel.textContent = t`主题 CSS (高级)：`;
    cssEditorLabel.style.display = 'block';
    cssEditorLabel.style.marginTop = '10px';
    const cssEditor = document.createElement('textarea');
    cssEditor.rows = 8;
    cssEditor.placeholder = t`在此处输入 CSS 代码。`;
    cssEditor.style.width = '100%';
    inlineDrawerContent.append(cssEditorLabel, cssEditor);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '5px';
    const saveButton = document.createElement('button');
    saveButton.textContent = t`保存当前主题`;
    saveButton.classList.add('primary-button');
    const newButton = document.createElement('button');
    newButton.textContent = t`新建主题`;
    newButton.classList.add('primary-button');
    const deleteButton = document.createElement('button');
    deleteButton.textContent = t`删除主题`;
    deleteButton.classList.add('danger-button'); 
    buttonContainer.append(saveButton, newButton, deleteButton);
    inlineDrawerContent.append(buttonContainer);

    const loadThemeIntoEditor = (themeName) => {
        cssEditor.value = settings.themes[themeName]?.css || '';
    };
    themeSelector.addEventListener('change', () => {
        const selectedTheme = themeSelector.value;
        settings.activeTheme = selectedTheme;
        applyTheme(selectedTheme);
        loadThemeIntoEditor(selectedTheme);
        saveSettingsDebounced();
    });
    saveButton.addEventListener('click', () => {
        const currentThemeName = themeSelector.value;
        settings.themes[currentThemeName].css = cssEditor.value;
        applyTheme(currentThemeName);
        saveSettingsDebounced();
        alert(t`主题 '${currentThemeName}' 已保存！`);
    });
    newButton.addEventListener('click', () => {
        const newThemeName = prompt(t`请输入新主题的名称：`);
        if (newThemeName && !settings.themes[newThemeName]) {
            settings.themes[newThemeName] = { css: `/* ${newThemeName} 的 CSS */` };
            settings.activeTheme = newThemeName;
            populateThemes();
            loadThemeIntoEditor(newThemeName);
            saveSettingsDebounced();
        } else if (settings.themes[newThemeName]) {
            alert(t`该名称的主题已存在！`);
        }
    });
    deleteButton.addEventListener('click', () => {
        const themeToDelete = themeSelector.value;
        if (themeToDelete === '默认') {
            alert(t`无法删除默认主题。`);
            return;
        }
        if (confirm(t`您确定要删除主题 '${themeToDelete}' 吗？`)) {
            delete settings.themes[themeToDelete];
            settings.activeTheme = '默认';
            populateThemes();
            applyTheme(settings.activeTheme);
            loadThemeIntoEditor(settings.activeTheme);
            saveSettingsDebounced();
        }
    });
    loadThemeIntoEditor(settings.activeTheme);
}

/**
 * 在聊天中显示一个打字指示器。
 */
function showTypingIndicator(type, _args, dryRun) {
    const settings = getSettings();
    const noIndicatorTypes = ['quiet', 'impersonate'];

    if (type !== 'refresh' && (noIndicatorTypes.includes(type) || dryRun)) {
        return;
    }

    if (!settings.enabled || (!settings.streaming && isStreamingEnabled())) {
        return;
    }
    
    if (settings.showCharName && !name2 && type !== 'refresh') {
        return;
    }

    if (legacyIndicatorTemplate && selected_group && !isStreamingEnabled()) {
        return;
    }

    // 构建最终显示的文本
    const placeholder = '{char}';
    let finalText = settings.customText || defaultSettings.customText;

    if (settings.showCharName && name2) {
        if (finalText.includes(placeholder)) {
            finalText = finalText.replace(placeholder, name2);
        } else {
            finalText = `${name2}${finalText}`;
        }
    } else {
        finalText = finalText.replace(placeholder, '').replace(/  +/g, ' ').trim();
    }

    const animationHtml = settings.animationEnabled ? '<div class="typing-ellipsis"></div>' : '';
    const colorStyle = settings.fontColor ? `color: ${settings.fontColor};` : '';
    const htmlContent = `
    <div style="display: flex; justify-content: center; align-items: center; width: 100%; ${colorStyle}">
        <div class="typing-indicator-text">${finalText}</div>
        ${animationHtml}
    </div>
`;

    const existingIndicator = document.getElementById('typing_indicator');
    if (existingIndicator) {
        existingIndicator.innerHTML = htmlContent;
        return;
    }

    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typing_indicator';
    typingIndicator.classList.add('typing_indicator');
    typingIndicator.innerHTML = htmlContent;

    const chat = document.getElementById('chat');
    if (chat) {
        // 检查用户是否已滚动到底部（允许有几个像素的误差）
        const wasChatScrolledDown = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 5;
        
        chat.appendChild(typingIndicator);

        // 如果用户在指示器出现前就位于底部，则自动滚动到底部以保持指示器可见
        if (wasChatScrolledDown) {
            chat.scrollTop = chat.scrollHeight;
        }
    }
}

/**
 * 隐藏打字指示器。
 */
function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing_indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

(function () {
    injectGlobalStyles();
    
    const settings = getSettings();
    addExtensionSettings(settings);

    applyTheme(settings.activeTheme);

    const showIndicatorEvents = [ event_types.GENERATION_AFTER_COMMANDS ];
    const hideIndicatorEvents = [ event_types.GENERATION_STOPPED, event_types.GENERATION_ENDED, event_types.CHAT_CHANGED ];

    showIndicatorEvents.forEach(e => eventSource.on(e, showTypingIndicator));
    hideIndicatorEvents.forEach(e => eventSource.on(e, hideTypingIndicator));
})();