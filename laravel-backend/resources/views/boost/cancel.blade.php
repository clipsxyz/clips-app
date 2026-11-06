<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#07090d">
    <title>Boost canceled · Gazetteer</title>
    <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom));
            background: #07090d;
            color: #fff;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        }
        main {
            width: 100%;
            max-width: 420px;
            text-align: center;
        }
        h1 {
            margin: 0 0 10px;
            font-size: 28px;
            line-height: 1.2;
            font-weight: 700;
        }
        p {
            margin: 0 0 22px;
            color: rgba(255, 255, 255, 0.74);
            font-size: 16px;
            line-height: 1.45;
        }
        button {
            display: flex;
            width: 100%;
            align-items: center;
            justify-content: center;
            min-height: 52px;
            border: 0;
            border-radius: 14px;
            background: #00f2ff;
            color: #041016;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <main>
        <h1>Boost payment was canceled</h1>
        <p>The payment was canceled or interrupted. No charge was made.</p>
        <button type="button" onclick="window.location.href = &quot;gazetteer://boost/cancel&quot;;">Return to Gazetteer App</button>
        <script>
            setTimeout(function () {
                window.location.href = "gazetteer://boost/cancel";
            }, 1500);
        </script>
    </main>
</body>
</html>
