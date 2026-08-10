#ifndef WEB_H
#define WEB_H

#include <WebServer.h>
#include <LittleFS.h>

extern WebServer webServer;

void initFileSystem();
void initWebServer();
void handleWebClient();

#endif
