"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const wait_1 = require("./wait");
const node_fetch_1 = __importDefault(require("node-fetch"));
const WAIT_LOOP_TIME = 1000 * 10; // Wait 10secs if no deploymets on each try
const MAX_RETRY_COUNT = 3; // Try three times to fetch the vercel preview
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get inputs
            const branchName = core.getInput('branch_name');
            const projectId = core.getInput('project_id');
            const teamId = core.getInput('team_id');
            core.info(`Branch Name : ${branchName}`);
            core.info(`Project ID : ${projectId}`);
            core.info(`Team ID : ${teamId}`);
            // Get Vercel Token
            const apiUrl = 'https://api.vercel.com/v6/deployments';
            const vercelToken = process.env.VERCEL_TOKEN;
            // Fetch vercel deployments
            const query = new URLSearchParams();
            query.append('projectId', projectId);
            if (teamId) {
                query.append('teamId', teamId);
            }
            const fullQueryUrl = `${apiUrl}?${query.toString()}`;
            let counter = 0;
            let deploymentUrl;
            // Do loop
            let retryCountToUse = MAX_RETRY_COUNT; // This is variable because if we find a matching deployment which just isn't deployed yet, we're happy to wait longer
            while (counter < retryCountToUse) {
                core.info(`Fetching : ${fullQueryUrl}`);
                const res = yield (0, node_fetch_1.default)(fullQueryUrl, {
                    headers: {
                        Authorization: `Bearer ${vercelToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                const data = yield res.json();
                // Look for a deployment with matching branch name
                const deployments = data.deployments.filter((deployment) => {
                    return deployment.meta.githubCommitRef === branchName;
                });
                // If one doesn't exist, wait and loop
                if (deployments.length === 0) {
                    core.info('No deployments found for query. Awaiting before retry');
                    yield (0, wait_1.wait)(WAIT_LOOP_TIME);
                    counter++;
                    continue;
                }
                else {
                    const deployment = deployments[0];
                    const url = deployment.url;
                    const state = deployment.state;
                    if (state === 'READY') {
                        deploymentUrl = `https://${url}`;
                        break;
                    }
                    if (state === 'CANCELED' || state === 'ERROR') {
                        throw new Error('Something went wrong with the preview deployment. State was CANCELED or ERROR');
                    }
                    core.info('Found matching deployment but state was not READY. Awaiting before retry');
                    retryCountToUse = 5; // Bump retry count because we know a good deployment is coming
                    counter++;
                    continue;
                }
            }
            if (counter >= retryCountToUse) {
                throw new Error('Hit maximum retry count waiting for Vercel Preview');
            }
            core.info(`Found Preview URL : ${deploymentUrl}`);
            // Return the deployment URL
            core.setOutput('preview_url', deploymentUrl);
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
run();
