// GENERATED from contract/openapi.json by plugin/scripts/gen-api-types.mjs. Do not edit.
// Regenerate: (server) python -m uninotes.cli export-openapi  ->  (plugin) npm run gen:api

export interface paths {
    "/api/commands": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Commands */
        get: operations["list_commands_api_commands_get"];
        put?: never;
        /**
         * Create Command
         * @description Create a command from the plugin or web console input box. Tag commands (@AI) are created by
         *     the server. Large document-wide requests come back as needs_confirmation with page_cost_estimate;
         *     re-send with confirm_pages to start.
         */
        post: operations["create_command_api_commands_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/commands/{command_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Command */
        get: operations["get_command_api_commands__command_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/commands/{command_id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancel Command */
        post: operations["cancel_command_api_commands__command_id__cancel_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Sessions
         * @description Newest first. Manual "process now" stays POST /api/jobs/trigger.
         */
        get: operations["list_sessions_api_sessions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sessions/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Session */
        get: operations["get_session_api_sessions__session_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Changes */
        get: operations["list_changes_api_changes_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/undo/session/{session_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Undo Session
         * @description Revert every applied change of a session (30 days). Blocks the user edited since are not
         *     overwritten; they come back in `conflicts`.
         */
        post: operations["undo_session_api_undo_session__session_id__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/undo/block/{block_key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Undo Block */
        post: operations["undo_block_api_undo_block__block_key__post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sync/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Sync Upload
         * @description Upload a user edit (body = file bytes). `base_sha256` is the server version the edit started
         *     from ("" for a new file). The server ignores echoes of its own versions, merges with the user's
         *     edit winning, and switches edited [!ai] blocks to user ownership. Only the primary device may
         *     upload (others get not_primary). Replaces PUT /api/sync/file for new plugin versions.
         */
        put: operations["sync_upload_api_sync_upload_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sync/ack": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sync Ack
         * @description The device applied everything up to `cursor` (vault_changes.seq).
         */
        post: operations["sync_ack_api_sync_ack_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sync/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sync State */
        get: operations["sync_state_api_sync_state_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Devices */
        get: operations["list_devices_api_devices_get"];
        put?: never;
        /**
         * Register Device
         * @description Register this plugin install; send the returned id as X-UniNotes-Device afterwards. The first
         *     device of a user becomes primary.
         */
        post: operations["register_device_api_devices_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/devices/{device_id}/primary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Set Primary Device */
        post: operations["set_primary_device_api_devices__device_id__primary_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/devices/{device_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke Device */
        delete: operations["revoke_device_api_devices__device_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/library/folders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Folders */
        get: operations["list_folders_api_library_folders_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/library/folders/{folder_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update Folder
         * @description Set the access area (in_scope) and/or folder mode. Only fields present in the body change.
         */
        patch: operations["update_folder_api_library_folders__folder_id__patch"];
        trace?: never;
    };
    "/api/library/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Documents
         * @description Server copies for the 파일 정리 screen (status filter shows "deleted" ones separately).
         */
        get: operations["list_documents_api_library_documents_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/library/documents/{document_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete Document
         * @description User deletes a server copy (파일 정리). Note blocks that came from it are kept.
         */
        delete: operations["delete_document_api_library_documents__document_id__delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/usage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Usage */
        get: operations["get_usage_api_usage_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get User Settings */
        get: operations["get_user_settings_api_settings_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Update User Settings */
        patch: operations["update_user_settings_api_settings_patch"];
        trace?: never;
    };
    "/api/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Notifications */
        get: operations["list_notifications_api_notifications_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mark Notifications Read */
        post: operations["mark_notifications_read_api_notifications_read_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Notification Prefs */
        get: operations["get_notification_prefs_api_notifications_settings_get"];
        /** Put Notification Prefs */
        put: operations["put_notification_prefs_api_notifications_settings_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/push/vapid-key": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Vapid Key */
        get: operations["vapid_key_api_push_vapid_key_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/push/subscriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Push Subscribe */
        post: operations["push_subscribe_api_push_subscriptions_post"];
        /** Push Unsubscribe */
        delete: operations["push_unsubscribe_api_push_subscriptions_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/status/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Status Stream
         * @description Live processing status for the console (EventSource, cookie auth) and the plugin (Bearer).
         *     Reconnect with Last-Event-ID to resume.
         */
        get: operations["status_stream_api_status_stream_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health */
        get: operations["health_api_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Me */
        get: operations["me_api_me_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/jobs/trigger": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Trigger */
        post: operations["trigger_api_jobs_trigger_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/jobs/latest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Latest Job */
        get: operations["latest_job_api_jobs_latest_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sync/changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Changes */
        get: operations["changes_api_sync_changes_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/sync/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get File */
        get: operations["get_file_api_sync_file_get"];
        /** Put File */
        put: operations["put_file_api_sync_file_put"];
        post?: never;
        /** Delete File */
        delete: operations["delete_file_api_sync_file_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * AckIn
         * @example {
         *       "cursor": 1043
         *     }
         */
        AckIn: {
            /**
             * Cursor
             * @description highest vault_changes.seq this device has applied
             */
            cursor: number;
        };
        /**
         * ChangeList
         * @example {
         *       "changes": [
         *         {
         *           "actor": "agent",
         *           "block_key": "ai-90ab",
         *           "created_at": "2026-11-05T09:03:12Z",
         *           "id": 812,
         *           "op": "update",
         *           "path": "일반물리/33장 전자기파.md",
         *           "session_id": "s4n8b2v6c1x5z9m3",
         *           "state": "applied"
         *         }
         *       ]
         *     }
         */
        ChangeList: {
            /** Changes */
            changes: components["schemas"]["ChangeOutV2"][];
        };
        /** ChangeOut */
        ChangeOut: {
            /** Seq */
            seq: number;
            /** Path */
            path: string;
            /** Op */
            op: string;
            /** Sha256 */
            sha256: string | null;
        };
        /**
         * ChangeOutV2
         * @example {
         *       "actor": "agent",
         *       "block_key": "ai-90ab",
         *       "created_at": "2026-11-05T09:03:12Z",
         *       "id": 812,
         *       "op": "update",
         *       "path": "일반물리/33장 전자기파.md",
         *       "session_id": "s4n8b2v6c1x5z9m3",
         *       "state": "applied"
         *     }
         */
        ChangeOutV2: {
            /** Id */
            id: number;
            /** Session Id */
            session_id?: string | null;
            /**
             * Actor
             * @enum {string}
             */
            actor: "agent" | "user" | "console" | "undo" | "system";
            /**
             * Op
             * @enum {string}
             */
            op: "create" | "update" | "delete" | "move";
            /** Path */
            path: string;
            /** New Path */
            new_path?: string | null;
            /** Block Key */
            block_key?: string | null;
            /**
             * State
             * @enum {string}
             */
            state: "pending" | "applied" | "failed" | "reverted" | "conflict";
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
        };
        /** ChangesOut */
        ChangesOut: {
            /** Cursor */
            cursor: number;
            /** More */
            more: boolean;
            /** Changes */
            changes: components["schemas"]["ChangeOut"][];
        };
        /**
         * CommandCreate
         * @example {
         *       "source": "plugin",
         *       "target": {
         *         "document_id": "k3m9x2p7q4r8s1t5"
         *       },
         *       "text": "이 문서 연습문제 풀이 정리해줘"
         *     }
         */
        CommandCreate: {
            /** Text */
            text: string;
            /**
             * Source
             * @description tag commands are created by the server, never via the API
             * @enum {string}
             */
            source: "plugin" | "web";
            target?: components["schemas"]["CommandTarget"] | null;
            /**
             * Confirm Pages
             * @description re-send with the estimate to confirm a 'N장 차감' request
             */
            confirm_pages?: number | null;
        };
        /**
         * CommandList
         * @example {
         *       "commands": [
         *         {
         *           "created_at": "2026-11-05T09:00:00Z",
         *           "id": "c8w2n5v1b7m3k9x4",
         *           "page_cost_estimate": 24,
         *           "source": "plugin",
         *           "status": "needs_confirmation",
         *           "target": {
         *             "document_id": "k3m9x2p7q4r8s1t5"
         *           },
         *           "text": "이 문서 연습문제 풀이 정리해줘"
         *         }
         *       ]
         *     }
         */
        CommandList: {
            /** Commands */
            commands: components["schemas"]["CommandOut"][];
        };
        /**
         * CommandOut
         * @example {
         *       "created_at": "2026-11-05T09:00:00Z",
         *       "id": "c8w2n5v1b7m3k9x4",
         *       "page_cost_estimate": 24,
         *       "source": "plugin",
         *       "status": "needs_confirmation",
         *       "target": {
         *         "document_id": "k3m9x2p7q4r8s1t5"
         *       },
         *       "text": "이 문서 연습문제 풀이 정리해줘"
         *     }
         */
        CommandOut: {
            /** Id */
            id: string;
            /**
             * Source
             * @enum {string}
             */
            source: "tag" | "plugin" | "web";
            /** Text */
            text: string;
            /**
             * Status
             * @enum {string}
             */
            status: "pending" | "needs_confirmation" | "running" | "done" | "failed" | "cancelled";
            target?: components["schemas"]["CommandTarget"] | null;
            /** Page Cost Estimate */
            page_cost_estimate?: number | null;
            /** Session Id */
            session_id?: string | null;
            /** Error */
            error?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Done At */
            done_at?: string | null;
        };
        /**
         * CommandTarget
         * @description Where a command points. Plugin/web commands may name a document (and page); tag commands get
         *     a target resolved by vision (bbox in PDF points on the page, quote = the text pointed at).
         */
        CommandTarget: {
            /** Document Id */
            document_id?: string | null;
            /** Page Index */
            page_index?: number | null;
            /** Bbox */
            bbox?: number[] | null;
            /** Quote */
            quote?: string | null;
            /** Block Keys */
            block_keys?: string[] | null;
        };
        /**
         * DeviceCreate
         * @example {
         *       "client_version": "0.2.0",
         *       "kind": "obsidian-desktop",
         *       "name": "MacBook Air"
         *     }
         */
        DeviceCreate: {
            /** Name */
            name: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "obsidian-desktop" | "obsidian-mobile" | "web";
            /** Client Version */
            client_version?: string | null;
        };
        /**
         * DeviceList
         * @example {
         *       "devices": [
         *         {
         *           "client_version": "0.2.0",
         *           "created_at": "2026-11-05T09:00:00Z",
         *           "id": "d2k7m4x9p1n6b3v8",
         *           "is_primary": true,
         *           "kind": "obsidian-desktop",
         *           "last_seen_at": "2026-11-05T09:03:12Z",
         *           "name": "MacBook Air"
         *         }
         *       ],
         *       "primary_device_id": "d2k7m4x9p1n6b3v8"
         *     }
         */
        DeviceList: {
            /** Devices */
            devices: components["schemas"]["DeviceOut"][];
            /** Primary Device Id */
            primary_device_id?: string | null;
        };
        /**
         * DeviceOut
         * @example {
         *       "client_version": "0.2.0",
         *       "created_at": "2026-11-05T09:00:00Z",
         *       "id": "d2k7m4x9p1n6b3v8",
         *       "is_primary": true,
         *       "kind": "obsidian-desktop",
         *       "last_seen_at": "2026-11-05T09:03:12Z",
         *       "name": "MacBook Air"
         *     }
         */
        DeviceOut: {
            /** Id */
            id: string;
            /** Name */
            name: string;
            /** Kind */
            kind: string;
            /** Client Version */
            client_version?: string | null;
            /**
             * Is Primary
             * @default false
             */
            is_primary: boolean;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Last Seen At */
            last_seen_at?: string | null;
        };
        /**
         * DocumentList
         * @example {
         *       "documents": [
         *         {
         *           "content_stored": true,
         *           "folder_id": "f6v1c8x3z5n2m7k4",
         *           "id": "k3m9x2p7q4r8s1t5",
         *           "kind": "notebook",
         *           "last_backup_at": "2026-11-05T09:00:00Z",
         *           "name": "33장 전자기파.pdf",
         *           "page_count": 9,
         *           "path": "DSHS 2-2/일반물리/33장 전자기파.pdf",
         *           "size_bytes": 4718592,
         *           "status": "active"
         *         }
         *       ],
         *       "total": 1
         *     }
         */
        DocumentList: {
            /** Documents */
            documents: components["schemas"]["DocumentOut"][];
            /** Total */
            total: number;
        };
        /**
         * DocumentOut
         * @example {
         *       "content_stored": true,
         *       "folder_id": "f6v1c8x3z5n2m7k4",
         *       "id": "k3m9x2p7q4r8s1t5",
         *       "kind": "notebook",
         *       "last_backup_at": "2026-11-05T09:00:00Z",
         *       "name": "33장 전자기파.pdf",
         *       "page_count": 9,
         *       "path": "DSHS 2-2/일반물리/33장 전자기파.pdf",
         *       "size_bytes": 4718592,
         *       "status": "active"
         *     }
         */
        DocumentOut: {
            /** Id */
            id: string;
            /** Folder Id */
            folder_id?: string | null;
            /** Name */
            name: string;
            /** Path */
            path: string;
            /**
             * Status
             * @enum {string}
             */
            status: "active" | "deleted_in_goodnotes" | "delete_marked";
            /**
             * Kind
             * @enum {string}
             */
            kind: "unknown" | "notebook" | "textbook" | "digital" | "returned";
            /**
             * Content Stored
             * @description false = outside the access area, metadata only
             */
            content_stored: boolean;
            /** Size Bytes */
            size_bytes?: number | null;
            /** Page Count */
            page_count?: number | null;
            /** Last Backup At */
            last_backup_at?: string | null;
            /** Delete Marked At */
            delete_marked_at?: string | null;
        };
        /**
         * FolderList
         * @example {
         *       "folders": [
         *         {
         *           "document_count": 12,
         *           "effective_in_scope": true,
         *           "effective_mode": "auto",
         *           "id": "f6v1c8x3z5n2m7k4",
         *           "in_scope": true,
         *           "name": "일반물리",
         *           "parent_id": "f0root0000000000",
         *           "path": "DSHS 2-2/일반물리",
         *           "status": "active"
         *         }
         *       ]
         *     }
         */
        FolderList: {
            /** Folders */
            folders: components["schemas"]["FolderOut"][];
        };
        /**
         * FolderOut
         * @example {
         *       "document_count": 12,
         *       "effective_in_scope": true,
         *       "effective_mode": "auto",
         *       "id": "f6v1c8x3z5n2m7k4",
         *       "in_scope": true,
         *       "name": "일반물리",
         *       "parent_id": "f0root0000000000",
         *       "path": "DSHS 2-2/일반물리",
         *       "status": "active"
         *     }
         */
        FolderOut: {
            /** Id */
            id: string;
            /** Parent Id */
            parent_id?: string | null;
            /** Name */
            name: string;
            /** Path */
            path: string;
            /**
             * Status
             * @enum {string}
             */
            status: "active" | "deleted_in_goodnotes" | "delete_marked";
            /**
             * In Scope
             * @description explicit setting; null = inherited
             */
            in_scope: boolean | null;
            /** Effective In Scope */
            effective_in_scope: boolean;
            /**
             * Mode
             * @description explicit setting; null = inherited
             */
            mode: ("auto" | "commands_only" | "exclude" | "auto_all_pages") | null;
            /**
             * Effective Mode
             * @enum {string}
             */
            effective_mode: "auto" | "commands_only" | "exclude" | "auto_all_pages";
            /**
             * Document Count
             * @default 0
             */
            document_count: number;
        };
        /**
         * FolderUpdate
         * @description Fields left out are unchanged. Send null to go back to inheriting from the parent.
         * @example {
         *       "in_scope": true,
         *       "mode": "commands_only"
         *     }
         */
        FolderUpdate: {
            /** In Scope */
            in_scope?: boolean | null;
            /** Mode */
            mode?: ("auto" | "commands_only" | "exclude" | "auto_all_pages") | null;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** JobOut */
        JobOut: {
            /** Id */
            id: number;
            /** Trigger */
            trigger: string;
            /** Status */
            status: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Finished At */
            finished_at: string | null;
            /** Report */
            report: string | null;
            /** Error */
            error: string | null;
        };
        /**
         * MarkReadIn
         * @example {
         *       "ids": [
         *         77
         *       ]
         *     }
         */
        MarkReadIn: {
            /**
             * Ids
             * @description null = mark everything read
             */
            ids?: number[] | null;
        };
        /** Me */
        Me: {
            /** Email */
            email: string;
            /** Idle Minutes */
            idle_minutes: number;
        };
        /**
         * NotImplementedOut
         * @description Body of 501 responses from endpoints whose implementation is not written yet.
         * @example {
         *       "endpoint": "POST /api/commands",
         *       "error": "not_implemented",
         *       "owner": "A2"
         *     }
         */
        NotImplementedOut: {
            /**
             * Error
             * @constant
             */
            error: "not_implemented";
            /**
             * Owner
             * @description session that owns the implementation: A1 | A2 | B | C
             */
            owner: string;
            /** Endpoint */
            endpoint: string;
        };
        /**
         * NotificationList
         * @example {
         *       "notifications": [
         *         {
         *           "body": "일반물리 33장 p.3 정리: 수식 4개, @AI 명령 3개 처리.",
         *           "created_at": "2026-11-05T09:03:12Z",
         *           "id": 77,
         *           "kind": "session_report",
         *           "link": "/sessions/s4n8b2v6c1x5z9m3",
         *           "session_id": "s4n8b2v6c1x5z9m3",
         *           "title": "정리 완료"
         *         }
         *       ],
         *       "unread": 1
         *     }
         */
        NotificationList: {
            /** Notifications */
            notifications: components["schemas"]["NotificationOut"][];
            /** Unread */
            unread: number;
        };
        /**
         * NotificationOut
         * @example {
         *       "body": "일반물리 33장 p.3 정리: 수식 4개, @AI 명령 3개 처리.",
         *       "created_at": "2026-11-05T09:03:12Z",
         *       "id": 77,
         *       "kind": "session_report",
         *       "link": "/sessions/s4n8b2v6c1x5z9m3",
         *       "session_id": "s4n8b2v6c1x5z9m3",
         *       "title": "정리 완료"
         *     }
         */
        NotificationOut: {
            /** Id */
            id: number;
            /**
             * Kind
             * @enum {string}
             */
            kind: "session_report" | "needs_confirmation" | "error" | "quota" | "announcement";
            /** Title */
            title: string;
            /** Body */
            body?: string | null;
            /** Link */
            link?: string | null;
            /** Session Id */
            session_id?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Read At */
            read_at?: string | null;
        };
        /**
         * NotificationPrefsIO
         * @example {
         *       "error": true,
         *       "needs_confirmation": true,
         *       "quota": false,
         *       "session_report": true
         *     }
         */
        NotificationPrefsIO: {
            /**
             * Session Report
             * @default true
             */
            session_report: boolean;
            /**
             * Needs Confirmation
             * @default true
             */
            needs_confirmation: boolean;
            /**
             * Error
             * @default true
             */
            error: boolean;
            /**
             * Quota
             * @default true
             */
            quota: boolean;
        };
        /**
         * Ok
         * @example {
         *       "ok": true
         *     }
         */
        Ok: {
            /**
             * Ok
             * @default true
             */
            ok: boolean;
        };
        /**
         * PushResult
         * @example {
         *       "path": "일반물리/33장 전자기파.md",
         *       "seq": 1043,
         *       "sha256": "9f2c000000000000000000000000000000000000000000000000000000000000",
         *       "status": "ok"
         *     }
         */
        PushResult: {
            /**
             * Status
             * @description ok: stored as a user edit. echo: identical to a version the server produced, ignored. conflict_merged: server changed since base_sha256, merged with the user's edit winning. conflict_copy: could not merge, saved next to it as a conflict copy. not_primary: this device is not the primary device; nothing stored.
             * @enum {string}
             */
            status: "ok" | "echo" | "conflict_merged" | "conflict_copy" | "not_primary";
            /** Path */
            path: string;
            /** Sha256 */
            sha256?: string | null;
            /**
             * Seq
             * @description vault_changes.seq of the resulting change
             */
            seq?: number | null;
            /** Conflict Path */
            conflict_path?: string | null;
        };
        /**
         * PushSubscriptionIn
         * @description The browser's PushSubscription.toJSON().
         * @example {
         *       "endpoint": "https://web.push.apple.com/QAbc...",
         *       "keys": {
         *         "auth": "tBH...",
         *         "p256dh": "BNc..."
         *       }
         *     }
         */
        PushSubscriptionIn: {
            /** Endpoint */
            endpoint: string;
            /**
             * Keys
             * @description {p256dh, auth}
             */
            keys: {
                [key: string]: string;
            };
        };
        /**
         * PushUnsubscribeIn
         * @example {
         *       "endpoint": "https://web.push.apple.com/QAbc..."
         *     }
         */
        PushUnsubscribeIn: {
            /** Endpoint */
            endpoint: string;
        };
        /**
         * SessionDetail
         * @example {
         *       "changes": [
         *         {
         *           "actor": "agent",
         *           "block_key": "ai-90ab",
         *           "created_at": "2026-11-05T09:03:12Z",
         *           "id": 812,
         *           "op": "update",
         *           "path": "일반물리/33장 전자기파.md",
         *           "session_id": "s4n8b2v6c1x5z9m3",
         *           "state": "applied"
         *         }
         *       ],
         *       "commands": [],
         *       "created_at": "2026-11-05T09:00:00Z",
         *       "finished_at": "2026-11-05T09:03:12Z",
         *       "id": "s4n8b2v6c1x5z9m3",
         *       "pages_charged": 1,
         *       "report": "일반물리 33장 p.3 정리: 수식 4개, @AI 명령 3개 처리 (풀이 2, 요약 1).",
         *       "report_detail": {
         *         "files": [
         *           "일반물리/33장 전자기파.md"
         *         ],
         *         "inbox": []
         *       },
         *       "stage": "report",
         *       "started_at": "2026-11-05T09:00:00Z",
         *       "status": "done",
         *       "trigger": "idle",
         *       "undoable": true
         *     }
         */
        SessionDetail: {
            /** Id */
            id: string;
            /** Trigger */
            trigger: string;
            /**
             * Status
             * @enum {string}
             */
            status: "queued" | "running" | "done" | "failed" | "halted_loop" | "halted_quota";
            /** Stage */
            stage?: string | null;
            /**
             * Report
             * @description ~400 characters, Korean
             */
            report?: string | null;
            /**
             * Pages Charged
             * @default 0
             */
            pages_charged: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Started At */
            started_at?: string | null;
            /** Finished At */
            finished_at?: string | null;
            /**
             * Undoable
             * @description has applied changes younger than 30 days
             * @default false
             */
            undoable: boolean;
            /** Report Detail */
            report_detail?: {
                [key: string]: unknown;
            } | null;
            /**
             * Commands
             * @default []
             */
            commands: components["schemas"]["CommandOut"][];
            /**
             * Changes
             * @default []
             */
            changes: components["schemas"]["ChangeOutV2"][];
            /** Error */
            error?: string | null;
        };
        /**
         * SessionList
         * @example {
         *       "sessions": [
         *         {
         *           "created_at": "2026-11-05T09:00:00Z",
         *           "finished_at": "2026-11-05T09:03:12Z",
         *           "id": "s4n8b2v6c1x5z9m3",
         *           "pages_charged": 1,
         *           "report": "일반물리 33장 p.3 정리: 수식 4개, @AI 명령 3개 처리 (풀이 2, 요약 1).",
         *           "stage": "report",
         *           "started_at": "2026-11-05T09:00:00Z",
         *           "status": "done",
         *           "trigger": "idle",
         *           "undoable": true
         *         }
         *       ]
         *     }
         */
        SessionList: {
            /** Sessions */
            sessions: components["schemas"]["SessionSummary"][];
            /**
             * Next Before
             * @description pass as ?before= for the next page
             */
            next_before?: string | null;
        };
        /**
         * SessionSummary
         * @example {
         *       "created_at": "2026-11-05T09:00:00Z",
         *       "finished_at": "2026-11-05T09:03:12Z",
         *       "id": "s4n8b2v6c1x5z9m3",
         *       "pages_charged": 1,
         *       "report": "일반물리 33장 p.3 정리: 수식 4개, @AI 명령 3개 처리 (풀이 2, 요약 1).",
         *       "stage": "report",
         *       "started_at": "2026-11-05T09:00:00Z",
         *       "status": "done",
         *       "trigger": "idle",
         *       "undoable": true
         *     }
         */
        SessionSummary: {
            /** Id */
            id: string;
            /** Trigger */
            trigger: string;
            /**
             * Status
             * @enum {string}
             */
            status: "queued" | "running" | "done" | "failed" | "halted_loop" | "halted_quota";
            /** Stage */
            stage?: string | null;
            /**
             * Report
             * @description ~400 characters, Korean
             */
            report?: string | null;
            /**
             * Pages Charged
             * @default 0
             */
            pages_charged: number;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Started At */
            started_at?: string | null;
            /** Finished At */
            finished_at?: string | null;
            /**
             * Undoable
             * @description has applied changes younger than 30 days
             * @default false
             */
            undoable: boolean;
        };
        /**
         * SyncState
         * @example {
         *       "acked": 1040,
         *       "device_id": "d2k7m4x9p1n6b3v8",
         *       "head": 1043,
         *       "is_primary": true,
         *       "primary_device_id": "d2k7m4x9p1n6b3v8"
         *     }
         */
        SyncState: {
            /**
             * Head
             * @description latest vault_changes.seq for this user
             */
            head: number;
            /**
             * Acked
             * @description this device's last ack
             */
            acked?: number | null;
            /** Device Id */
            device_id?: string | null;
            /** Primary Device Id */
            primary_device_id?: string | null;
            /**
             * Is Primary
             * @default false
             */
            is_primary: boolean;
        };
        /**
         * UndoConflict
         * @example {
         *       "block_key": "ai-90ab",
         *       "path": "일반물리/33장 전자기파.md",
         *       "reason": "사용자가 이후 수정한 블록이라 되돌리지 않았습니다"
         *     }
         */
        UndoConflict: {
            /** Path */
            path: string;
            /** Block Key */
            block_key?: string | null;
            /** Reason */
            reason: string;
        };
        /**
         * UndoResult
         * @example {
         *       "conflicts": [
         *         {
         *           "block_key": "ai-90ab",
         *           "path": "일반물리/33장 전자기파.md",
         *           "reason": "사용자가 이후 수정한 블록이라 되돌리지 않았습니다"
         *         }
         *       ],
         *       "reverted": 3
         *     }
         */
        UndoResult: {
            /**
             * Reverted
             * @description number of change_log rows reverted
             */
            reverted: number;
            /**
             * Conflicts
             * @default []
             */
            conflicts: components["schemas"]["UndoConflict"][];
            /**
             * Session Id
             * @description processing session that applied the undo, if any
             */
            session_id?: string | null;
        };
        /**
         * UsageOut
         * @example {
         *       "month": "2026-11",
         *       "pages_limit": 1000,
         *       "pages_used": 132,
         *       "storage_bytes": 734003200,
         *       "storage_limit_bytes": 5368709120
         *     }
         */
        UsageOut: {
            /**
             * Month
             * @description YYYY-MM (Asia/Seoul)
             */
            month: string;
            /** Pages Used */
            pages_used: number;
            /** Pages Limit */
            pages_limit: number;
            /** Storage Bytes */
            storage_bytes: number;
            /** Storage Limit Bytes */
            storage_limit_bytes: number;
            /** Processing Paused Reason */
            processing_paused_reason?: ("quota" | "budget" | "admin" | "maintenance") | null;
        };
        /**
         * UserSettingsOut
         * @example {
         *       "idle_minutes": 30,
         *       "thresholds": {},
         *       "web_search": "explicit"
         *     }
         */
        UserSettingsOut: {
            /** Idle Minutes */
            idle_minutes: number;
            /**
             * Web Search
             * @enum {string}
             */
            web_search: "explicit" | "always";
            /**
             * Thresholds
             * @default {}
             */
            thresholds: {
                [key: string]: unknown;
            };
        };
        /**
         * UserSettingsUpdate
         * @example {
         *       "idle_minutes": 30
         *     }
         */
        UserSettingsUpdate: {
            /** Idle Minutes */
            idle_minutes?: number | null;
            /** Web Search */
            web_search?: ("explicit" | "always") | null;
            /** Thresholds */
            thresholds?: {
                [key: string]: unknown;
            } | null;
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input?: unknown;
            /** Context */
            ctx?: Record<string, never>;
        };
        /**
         * VapidKeyOut
         * @example {
         *       "public_key": "BOrj5Y...base64url..."
         *     }
         */
        VapidKeyOut: {
            /** Public Key */
            public_key: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    list_commands_api_commands_get: {
        parameters: {
            query?: {
                status?: ("pending" | "needs_confirmation" | "running" | "done" | "failed" | "cancelled") | null;
                limit?: number;
            };
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CommandList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    create_command_api_commands_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CommandCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CommandOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    get_command_api_commands__command_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path: {
                command_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CommandOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    cancel_command_api_commands__command_id__cancel_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path: {
                command_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CommandOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    list_sessions_api_sessions_get: {
        parameters: {
            query?: {
                limit?: number;
                before?: string | null;
            };
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    get_session_api_sessions__session_id__get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionDetail"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    list_changes_api_changes_get: {
        parameters: {
            query?: {
                session_id?: string | null;
                block_key?: string | null;
                limit?: number;
            };
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChangeList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    undo_session_api_undo_session__session_id__post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path: {
                session_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UndoResult"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    undo_block_api_undo_block__block_key__post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path: {
                block_key: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UndoResult"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    sync_upload_api_sync_upload_put: {
        parameters: {
            query: {
                path: string;
                base_sha256?: string;
            };
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/octet-stream": string;
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PushResult"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    sync_ack_api_sync_ack_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AckIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyncState"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    sync_state_api_sync_state_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyncState"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    list_devices_api_devices_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeviceList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    register_device_api_devices_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DeviceCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeviceOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    set_primary_device_api_devices__device_id__primary_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path: {
                device_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeviceList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    revoke_device_api_devices__device_id__delete: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path: {
                device_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    list_folders_api_library_folders_get: {
        parameters: {
            query?: {
                /** @description omit for the root's children */
                parent_id?: string | null;
                include_deleted?: boolean;
            };
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FolderList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    update_folder_api_library_folders__folder_id__patch: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path: {
                folder_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FolderUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FolderOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    list_documents_api_library_documents_get: {
        parameters: {
            query?: {
                folder_id?: string | null;
                status?: ("active" | "deleted_in_goodnotes" | "delete_marked") | null;
                sort?: "name" | "last_backup" | "size";
                order?: "asc" | "desc";
                limit?: number;
                offset?: number;
            };
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    delete_document_api_library_documents__document_id__delete: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path: {
                document_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    get_usage_api_usage_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UsageOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    get_user_settings_api_settings_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserSettingsOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    update_user_settings_api_settings_patch: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UserSettingsUpdate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserSettingsOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    list_notifications_api_notifications_get: {
        parameters: {
            query?: {
                unread_only?: boolean;
                limit?: number;
            };
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationList"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    mark_notifications_read_api_notifications_read_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MarkReadIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    get_notification_prefs_api_notifications_settings_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationPrefsIO"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    put_notification_prefs_api_notifications_settings_put: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NotificationPrefsIO"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationPrefsIO"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    vapid_key_api_push_vapid_key_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VapidKeyOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    push_subscribe_api_push_subscriptions_post: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PushSubscriptionIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    push_unsubscribe_api_push_subscriptions_delete: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PushUnsubscribeIn"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    status_stream_api_status_stream_get: {
        parameters: {
            query?: never;
            header?: {
                /** @description Bearer <plugin token> (or use the console session cookie) */
                authorization?: string;
                /** @description registered device id (POST /api/devices) */
                "x-uninotes-device"?: string | null;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Server-Sent Events; each `data:` is a StatusEvent */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": {
                        /**
                         * Type
                         * @enum {string}
                         */
                        type: "session_started" | "session_progress" | "session_done" | "sync_available" | "notification" | "hello";
                        /** Session Id */
                        session_id?: string | null;
                        /** Stage */
                        stage?: string | null;
                        /** Message */
                        message?: string | null;
                        /**
                         * Data
                         * @default {}
                         */
                        data: {
                            [key: string]: unknown;
                        };
                        /**
                         * At
                         * Format: date-time
                         */
                        at: string;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
            /** @description not implemented yet (owner in body) */
            501: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: components["schemas"]["NotImplementedOut"];
                    };
                };
            };
        };
    };
    health_api_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    me_api_me_get: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Me"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    trigger_api_jobs_trigger_post: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    latest_job_api_jobs_latest_get: {
        parameters: {
            query?: never;
            header?: {
                authorization?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobOut"] | null;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    changes_api_sync_changes_get: {
        parameters: {
            query?: {
                since?: number;
            };
            header?: {
                authorization?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChangesOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    get_file_api_sync_file_get: {
        parameters: {
            query: {
                path: string;
            };
            header?: {
                authorization?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    put_file_api_sync_file_put: {
        parameters: {
            query: {
                path: string;
                base_sha256?: string;
            };
            header?: {
                authorization?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    delete_file_api_sync_file_delete: {
        parameters: {
            query: {
                path: string;
                base_sha256?: string;
            };
            header?: {
                authorization?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
