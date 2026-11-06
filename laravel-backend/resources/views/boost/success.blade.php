<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#07090d">
    <title>{{ $paid ? 'Payment Successful' : 'Payment not confirmed' }} · Gazetteer</title>
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
        a {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 52px;
            border-radius: 14px;
            background: #00f2ff;
            color: #041016;
            font-size: 16px;
            font-weight: 700;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <main>
        @if($paid && $sessionId)
            <h1>Payment Successful!</h1>
            <p>Boost is being activated...</p>
            <a href="gazetteer://boost/success?session_id={{ urlencode($sessionId) }}" class="open-app" id="open-app">Open Gazetteer App</a>
            <script>
                var appUrl = "gazetteer://boost/success?session_id=" + encodeURIComponent(@json($sessionId));
                window.location.href = appUrl;
                (function () {
                    var intentUrl = "intent://boost/success?session_id=" + encodeURIComponent(@json($sessionId)) + "#Intent;scheme=gazetteer;package=com.clipsapp;end";
                    var android = /Android/i.test(navigator.userAgent || "");
                    var link = document.getElementById("open-app");
                    if (link && android) {
                        link.addEventListener("click", function (event) {
                            event.preventDefault();
                            window.location.href = intentUrl;
                        });
                    }
                    if (android) {
                        setTimeout(function () {
                            window.location.href = intentUrl;
                        }, 400);
                    }
                })();
            </script>
        @else
            <h1>Payment not confirmed</h1>
            <p>We couldn't verify this checkout. If you were charged, open Gazetteer and check the boost on your post.</p>
            <a href="gazetteer://boost/cancel">Open Gazetteer App</a>
        @endif
    </main>
</body>
</html>
