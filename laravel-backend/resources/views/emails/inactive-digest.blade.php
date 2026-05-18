<x-mail::message>
# Hi {{ $user->display_name ?: $user->handle }},

You have not opened Gazetteer in a while. Here is what happened while you were away.

@if(($digest['area_post_count'] ?? 0) > 0)
**{{ $digest['area_post_count'] }}** new post(s) in **{{ $digest['regional_label'] }}**
@endif

@if(($digest['following_post_count'] ?? 0) > 0)
**{{ $digest['following_post_count'] }}** new post(s) from people you follow
@endif

@if(($digest['unread_notification_count'] ?? 0) > 0)
**{{ $digest['unread_notification_count'] }}** unread notification(s) (likes, comments, follows)
@endif

@if(!empty($digest['highlights']))
@foreach($digest['highlights'] as $item)
- **{{ $item['handle'] }}** — {{ $item['excerpt'] }}
@endforeach
@endif

<x-mail::button :url="$openUrl">
Open Gazetteer
</x-mail::button>

You are receiving this because you signed up for Gazetteer. You can turn off these emails in your profile settings.

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
