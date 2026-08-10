#include "config.h"
#include "web.h"

WebServer webServer(HTTP_PORT);

static String getContentType(const String& path)
{
    if (path.endsWith(".html") || path.endsWith(".htm")) return "text/html";
    if (path.endsWith(".css"))                           return "text/css";
    if (path.endsWith(".js"))                            return "application/javascript";
    if (path.endsWith(".json"))                          return "application/json";
    if (path.endsWith(".png"))                           return "image/png";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg"))  return "image/jpeg";
    if (path.endsWith(".gif"))                           return "image/gif";
    if (path.endsWith(".svg"))                           return "image/svg+xml";
    if (path.endsWith(".ico"))                           return "image/x-icon";
    return "text/plain";
}

void handleFileRequest()
{
    String path = webServer.uri();

    if (path.endsWith("/"))
    {
        path += "index.html";
    }

    if (!LittleFS.exists(path))
    {
        path = "/index.html";
    }

    File file = LittleFS.open(path, "r");
    if (!file)
    {
        webServer.send(404, "text/plain", "404: Not Found");
        return;
    }

    webServer.streamFile(file, getContentType(path));
    file.close();
}

void initFileSystem()
{
    if (!LittleFS.begin())
    {
        Serial.println("LittleFS mount failed");
        return;
    }

    Serial.println("LittleFS mounted");
    Serial.print("  Total bytes: ");
    Serial.println(LittleFS.totalBytes());
    Serial.print("  Used bytes:  ");
    Serial.println(LittleFS.usedBytes());
}

void initWebServer()
{
    webServer.onNotFound(handleFileRequest);
    webServer.begin();

    Serial.println("HTTP server started on port " + String(HTTP_PORT));
}

void handleWebClient()
{
    webServer.handleClient();
}
