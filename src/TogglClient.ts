import moment, { Moment } from 'moment';
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

export interface IProject {
    active: boolean;
    actual_hours: number | null;
    actual_seconds: number | null;
    at: string;
    auto_estimates: boolean | null;
    billable: boolean | null;
    cid: number;
    client_id: number | null;
    color: string;
    created_at: string;
    currency: string | null;
    current_period: {
        end_date: string;
        start_date: string;
    } | null;
    end_date: string;
    estimated_hours: number | null;
    estimated_seconds: number | null;
    fixed_fee: number;
    id: number;
    is_private: boolean;
    name: string;
    permissions: string;
    rate: number;
    rate_last_updated: string | null;
    recurring: boolean;
    recurring_parameters: {
        custom_period: number;
        estimated_seconds: number;
        parameter_end_date: string | null;
        parameter_start_date: string;
        period: string;
        project_start_date: string;
    }[] | null;
    server_deleted_at: string | null;
    start_date: string;
    status: string;
    template: boolean | null;
    template_id: number | null;
    wid: number;
    workspace_id: number;
}

export interface IBatchOperationParam {
    op: 'add' | 'remove' | 'replace';
    path: `/${keyof ITimeEntry}`; // The path to the entity to patch (e.g. /description)
    value?: string | number;
}

export interface IBatchOperation {
    success: number[]
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

    async getWorkspaces(): Promise<IWorkspace> {
        return await this.request<IWorkspace>(`me/workspaces`, "GET");
    }

    public async createTimeEntry(description: string, workspace_id: number, project_id?: number, start: string = moment().format(), duration: number = -1): Promise<ITimeEntry> {
        const body = {
            created_with: "Toggl Notes",
            description,
            start,
            workspace_id,
            duration,
            project_id
        };

        return await this.request<ITimeEntry>(`workspaces/${workspace_id}/time_entries`, "POST", body);
    }

    public async updateTimeEntries(timeEntriesIds: number[], workspaceId: number, ops: IBatchOperationParam[]): Promise<IBatchOperation> {
        return await this.request<IBatchOperation>(`workspaces/${workspaceId}/time_entries/${timeEntriesIds.join(',')}`, 'PATCH', ops);
    }

    async stopTimeEntry(entryId: number, workspaceId: number): Promise<ITimeEntry> {
        return await this.request<ITimeEntry>(`workspaces/${workspaceId}/time_entries/${entryId}/stop`, "PATCH");
    }

    async getCurrentTimeEntry(): Promise<ITimeEntry> {
        return await this.request<ITimeEntry>(`me/time_entries/current`, "GET");
    }

    async getEntries(start_date: Moment, end_date: Moment): Promise<ITimeEntry[]> { 
        const params = new URLSearchParams({start_date: start_date.format('YYYY-MM-DD'), end_date: end_date.format('YYYY-MM-DD') });

        return await this.request<ITimeEntry[]>(`me/time_entries?${params}`, "GET")
    }

    async createProject(projectName: string, workspaceId: number): Promise<IProject> {
        return await this.request<IProject>(`workspaces/${workspaceId}/projects`, 'POST', { name: projectName })
    }

    async getProjects(): Promise<IProject[]> {
        return await this.request<IProject[]>(`me/projects`, "GET")
    }
}

