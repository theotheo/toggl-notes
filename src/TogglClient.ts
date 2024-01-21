import moment from 'moment';
import { requestUrl, RequestUrlParam } from 'obsidian';

export interface ITimeEntry {
	at: string;
	billable: boolean;
	description: string;
	duration: number; // DurationInSeconds for running entries should be -1 * (Unix start time).
	duronly: boolean;
	id: number;
	pid: number;
	project_id: number;
	server_deleted_at: string;
	start: string;
	stop: string;
	tag_ids?: number[]; // NOTE: Toggl's API docs does not specify the type
	tags?: string[]; // NOTE: Toggl's API docs does not specify the type
	task_id: number | null;
	tid: number;
	uid: number;
	user_id: number;
	wid: number;
	workspace_id: number;
}

export interface IMe {
	api_token?: string;
	at: string; // format: date-time
	beginning_of_week: number;
	country_id: number;
	created_at: string; // format: date-time
	default_workspace_id: number;
	email: string; // format: email
	fullname: string;
	id: number;
	image_url: string;
	intercom_hash?: string;
	openid_email: string; // format: email
	openid_enabled: boolean;
	options: any;
	timezone: string;
	updated_at: string; // format: date-time
}

export default class TogglApiClient {
    private baseURL: string;
    private headers: Record<string, string>;
    private authorizationHeader: string | null;
    // private workspaceId: number;

    constructor(apiKey: string) {
        this.baseURL = "https://api.track.toggl.com/api/v9/";
        this.headers = {
            "accept": "*/*",
            "accept-language": "en-US",
        };
        this.authorizationHeader = `Basic ${btoa(`${apiKey}:api_token`)}`;
        // this.workspaceId = workspaceId;
    }

    private async request<T>(endpoint: string, method: string, body?: any): Promise<T> {
        const url = this.baseURL + endpoint;
        const headers: Record<string, string> = { ...this.headers };

        if (this.authorizationHeader) {
            headers["authorization"] = this.authorizationHeader;
        }

        const requestParams: RequestUrlParam = {
            url,
            method,
            headers,
            contentType: "application/json", 
            throw: false,
        };

        if (body) {
            requestParams.body = JSON.stringify(body)
        }

        
        const response = await requestUrl(requestParams);
        if (response.status === 200) {
            return response.json as T
        } else {
            throw response.text
        }
     
    }

    public async getUserInfo(): Promise<IMe> {
        return await this.request<IMe>("me", "GET");
    }

    public async createTimeEntry(description: string, workspaceId: number, start: string = moment().format(), duration: number = -1): Promise<ITimeEntry> {
        const body = {
            description: description,
            created_with: "Toggl Notes",
            start: start,
            workspace_id: workspaceId,
            duration: duration,
        };

        return await this.request<ITimeEntry>(`workspaces/${workspaceId}/time_entries`, "POST", body);
    }

    async stopTimeEntry(entryId: number, workspaceId: number): Promise<ITimeEntry> {
        return await this.request<ITimeEntry>(`workspaces/${workspaceId}/time_entries/${entryId}/stop`, "PATCH");
    }

    async getCurrentTimeEntry(): Promise<ITimeEntry> {
        return await this.request<ITimeEntry>(`me/time_entries/current`, "GET");
    }
}

