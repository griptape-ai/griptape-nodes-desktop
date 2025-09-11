import { BrowserWindow } from "electron";
import { GtnService } from "src/common/services/gtn-service";
import { CustomAuthService } from "../common/services/auth/custom";
import { HttpAuthService } from "../common/services/auth/http";
import { EngineService } from "../common/services/engine-service";
import { MetricsService } from "../common/services/metrics-service";
import { SetupService } from "../common/services/setup-service"
import { Bus } from "./bus";
import { logger } from '@/logger';

type AppState = {
    apiKey?: string,
    uvExecutablePath?: string,
    uvVersion?: string,
    pythonExecutablePath?: string,
    pythonVersion?: string,
    gtnExecutablePath?: string,
    gtnVersion?: string,
}

export class Coordinator {
    state: AppState
    
    constructor(
        private setupService: SetupService,
        private authService: HttpAuthService, //|CustomAuthService,
        private gtnService: GtnService,
        private engineService: EngineService,
        private metricsService: MetricsService,
    ) {
        this.state = {};
        
        this.setupService.on('setup:uv:succeeded', ({ uvExecutablePath, uvVersion }) => {
            logger.info("[COORD] this.setupService.on('setup:uv:succeeded')");
            this.state.uvExecutablePath = uvExecutablePath;
            this.state.uvVersion = uvVersion;
        });
        
        this.setupService.on('setup:python:succeeded', ({ pythonExecutablePath, pythonVersion }) => {
            logger.info("[COORD] this.setupService.on('setup:python:succeeded')");
            this.state.pythonExecutablePath = pythonExecutablePath;
            this.state.pythonVersion = pythonVersion;
        });
        
        this.setupService.on('setup:gtn:succeeded', async ({ gtnExecutablePath, gtnVersion }) => {
            logger.info("[COORD] this.setupService.on('setup:gtn:succeeded')");
            this.state.gtnExecutablePath = gtnExecutablePath;
            this.state.gtnVersion = gtnVersion;
            
            // HACK! Lazily setting the executable path this way SUCKS!
            this.gtnService.setGtnExecutablePath(gtnExecutablePath);
            await gtnService.syncLibraries();
            await gtnService.registerLibraries();
            // I don't actually think this is the right place to start it, but it works for now.
            engineService.start();
        });
        
        this.authService.on('auth:http:login:started', () => {
            logger.info("[COORD] this.authService.on('auth:http:login:started')");
        })
        
        this.authService.on('auth:http:login:succeeded', async (results) => {
            const { apiKey } = results;
            const partialApiKey = [apiKey.slice(0, 7), apiKey.slice(-5, -1)].join("...");
            logger.info("[COORD] this.authService.on('auth:http:login:succeeded') apikey: ", partialApiKey);
            this.state.apiKey = apiKey;

            // Send success event to all windows
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('auth:login-success', results);
            });
            
            // ????? NOW!? --- no after initializing for the first time of course - a new event!
            logger.info("[COORD] auth:http:login:succeeded - engineService.start()");
            engineService.start();
        });

        this.authService.on('auth:http:apiKey:changed', async ({ apiKey }) => {
            const partialApiKey = [apiKey.slice(0, 7), apiKey.slice(-5, -1)].join("...");
            logger.info("[COORD] await gtnService.initialize({apiKey}) apiKey:", partialApiKey);
            await gtnService.initialize({apiKey});
        })
        
        this.authService.on('auth:http:login:failed', ({ reason }) => {
            logger.info("[COORD] this.authService.on('auth:http:login:failed')");
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('auth:login-error', reason);
            });
        });
        
        this.engineService.on('engine:status-changed', (status) => {
            logger.info("[COORD] this.engineService.on('engine:status-changed') status=", status);
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('engine:status-changed', status);
            });
        });
        
        this.engineService.on('engine:log', (log) => {
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('engine:log', log);
            });
        });
        
        // Forward metrics events to all windows
        this.metricsService.on('metrics:updated', (metrics) => {
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('metrics:updated', metrics);
            });
        });
        
        this.metricsService.on('metrics:error', (error) => {
            logger.error("[COORD] Metrics collection error:", error);
            BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('metrics:error', error.message);
            });
        });
        
    }
    
    async start() {
        this.setupService.start();
        this.authService.start();
        this.metricsService.start(); // Start metrics collection immediately
    }
    
    async stop() {
        this.metricsService.destroy();
    }
}