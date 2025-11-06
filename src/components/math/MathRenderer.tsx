import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

type MathRendererProps = {
  formula: string;
  displayMode?: boolean;
  style?: ViewStyle;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
};

export default function MathRenderer({
  formula,
  displayMode = false,
  style,
  fontSize = 16,
  textColor = '#000000',
  backgroundColor = 'transparent',
}: MathRendererProps) {
  const [webViewHeight, setWebViewHeight] = useState(40);

  if (!formula || typeof formula !== 'string') {
    return null;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css">
      <script src="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js"></script>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: ${displayMode ? '12px' : '4px'} 8px;
          background-color: ${backgroundColor};
          display: flex;
          align-items: ${displayMode ? 'center' : 'flex-start'};
          justify-content: ${displayMode ? 'center' : 'flex-start'};
          min-height: ${displayMode ? '60px' : 'auto'};
          overflow: hidden;
          width: 100%;
        }
        #formula {
          color: ${textColor};
          font-size: ${fontSize}px;
          line-height: 1.5;
          width: 100%;
        }
        .katex {
          font-size: ${fontSize}px !important;
        }
        .katex-display {
          margin: 0;
          padding: 8px 0;
        }
      </style>
    </head>
    <body>
      <div id="formula"></div>
      <script>
        try {
          katex.render(${JSON.stringify(formula)}, document.getElementById("formula"), {
            throwOnError: false,
            displayMode: ${displayMode},
          });
          
          // Calculate actual content height and send to React Native
          setTimeout(function() {
            const formulaEl = document.getElementById("formula");
            const height = Math.max(formulaEl.scrollHeight, formulaEl.offsetHeight, ${displayMode ? 60 : 40});
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: height }));
          }, 100);
        } catch (e) {
          document.getElementById("formula").innerHTML = '<span style="color: red;">Error: ' + e.message + '</span>';
          const height = Math.max(document.getElementById("formula").scrollHeight, 40);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height: height }));
        }
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'height' && data.height) {
        // Add some padding to ensure content isn't cut off
        setWebViewHeight(Math.max(data.height + 10, 40));
      }
    } catch (e) {
      // Ignore parse errors
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        style={[styles.webview, { backgroundColor, height: webViewHeight }]}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 40,
  },
  webview: {
    backgroundColor: 'transparent',
    minHeight: 40,
  },
});

