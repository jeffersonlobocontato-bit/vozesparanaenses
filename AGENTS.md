<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI metering uses the external content database only; the managed database holds auth/email infrastructure.
- All Gateway calls use the shared Web-standard metering core and request-scoped Deno context; this preserves prompts and isolates concurrent function/cluster attribution without persisting content.
- AI costs are immutable per-call snapshots from database prices; unknown usage stays NULL and reports show incomplete coverage rather than claiming zero spend.
- External schema changes are staged in supabase-external and require application to that database; the managed migration tool must never be used for external content tables.
