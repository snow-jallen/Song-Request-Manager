using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DotNetEnv;
using Sprache;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using Microsoft.VisualBasic;

Env.Load();
var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://127.0.0.1:5001");

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddCors();
builder.Services.AddSignalR();
// Run the auto-add background service under the host lifecycle
builder.Services.AddHostedService<AutoAddService>();


var app = builder.Build();
app.UseCors(x => x.AllowAnyHeader().AllowAnyOrigin().AllowAnyMethod());
app.MapHub<SongRequestManager>("/songRequestManager");
app.UseDefaultFiles();
app.UseStaticFiles();


var hub = app.Services.GetRequiredService<IHubContext<SongRequestManager>>();

var periodicTimer = new PeriodicTimer(TimeSpan.FromMinutes(25));

// Debounced broadcast queue + instrumentation
var broadcastQueue = new ConcurrentQueue<string>();
var broadcastCounts = new ConcurrentDictionary<string, int>();
var broadcastInterval = TimeSpan.FromMilliseconds(300);
var broadcastCts = new CancellationTokenSource();

void BroadcastEvent(string source)
{
    try
    {
        broadcastQueue.Enqueue(source ?? "unknown");
        broadcastCounts.AddOrUpdate(source ?? "unknown", 1, (k, v) => v + 1);
    }
    catch (Exception ex)
    {

    }
}

async Task DebounceBroadcaster(CancellationToken token)
{
    while (!token.IsCancellationRequested)
    {
        try
        {
            await Task.Delay(broadcastInterval, token);
        }
        catch (TaskCanceledException)
        {
            break;
        }

        if (broadcastQueue.IsEmpty)
            continue;

        var drained = new List<string>();
        while (broadcastQueue.TryDequeue(out var src))
        {
            drained.Add(src ?? "unknown");
        }

        var triggers = drained.Distinct().ToList();
        var total = drained.Count;
        var countsSnapshot = broadcastCounts.Select(kv => $"{kv.Key}={kv.Value}").ToArray();

        try
        {
            await hub.Clients.All.SendAsync("ReceiveSongRequestUpdate");
        }
        catch (Exception ex)
        {
        }
    }
}

// Start the debounced broadcaster background task
_ = Task.Run(() => DebounceBroadcaster(broadcastCts.Token));


async Task RefreshAccessTokenPeriodically()
{
    while (await periodicTimer.WaitForNextTickAsync())
    {
        await APIManager.AccessToken();
        var refreshTasks = PlaylistManager.Admins.Keys.Select(user => RefreshAccessToken(user));

        await Task.WhenAll(refreshTasks);
    }
}

async Task RefreshAccessToken(string user)
{
    if (!PlaylistManager.Admins.ContainsKey(user) || PlaylistManager.Admins[user] == null)
    {
        return;
    }

    var client = new HttpClient();
    // ACCEPT header
    client.DefaultRequestHeaders.Accept.Add(
         new MediaTypeWithQualityHeaderValue("application/json"));
    var request = new HttpRequestMessage(HttpMethod.Post, "https://accounts.spotify.com/api/token");
    // CONTENT-TYPE header
    request.Content = new StringContent("{\"name\":\"John Doe\",\"age\":33}",
                         Encoding.UTF8, "application/json");
    var clientId = Environment.GetEnvironmentVariable("SPOTIFY_CLIENT_ID");
    var clientSecret = Environment.GetEnvironmentVariable("SPOTIFY_CLIENT_SECRET");
    var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
    request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);

    request.Content = new FormUrlEncodedContent(new[]
    {
        new KeyValuePair<string, string>("grant_type", "refresh_token"),
        new KeyValuePair<string, string>("refresh_token", PlaylistManager.Admins[user].userRefreshToken),
        new KeyValuePair<string, string>("client_id", clientId)
    });
    var response = await client.SendAsync(request);
    var JsonObjectResponse = JsonSerializer.Deserialize<JsonObject>(await response.Content.ReadAsStringAsync());
    JsonObjectResponse.TryGetPropertyValue("access_token", out JsonNode jsonNode);
    PlaylistManager.Admins[user].userAccessToken = jsonNode.ToString();
}
async Task removeSongAsync(string user, string songId, bool broadcast = true)
{
    int index;
    SongData song;

    song = PlaylistManager.RequestedSongs[user].Find(s => s.id == songId);
    PlaylistManager.RequestedSongs[user].Remove(song);

    if (PlaylistManager.RequestedSongs[user].Count() <= 0)
    {
        PlaylistManager.RequestedSongs.Remove(user);
    }

    if (PlaylistManager.getSongRequestCount(songId) == 0)
    {
        index = PlaylistManager.AllSongs.FindIndex(s => s.id == songId);
        PlaylistManager.AllSongs.RemoveAt(index);
    }
}


app.MapGet("/ping", () =>
{
    Console.WriteLine("Ping received to keep awake.");
    return Results.Ok("Keeping awake");
});

app.MapGet("/login/{user}", (string user, string returnTo = $"http://127.0.0.1:5001/me/abc") =>
{
    var redirectUri = Uri.EscapeDataString(Environment.GetEnvironmentVariable("SPOTIFY_REDIRECT_URI"));
    string returnToUri = Uri.EscapeDataString(returnTo);
    State tempState = new(user, returnToUri);
    string state = JsonSerializer.Serialize(tempState);

    var ClientId = Environment.GetEnvironmentVariable("SPOTIFY_CLIENT_ID");

    var url = $"https://accounts.spotify.com/authorize" +
              $"?client_id={ClientId}" +
              $"&response_type=code" +
              $"&redirect_uri={redirectUri}" +
              $"&state={state}" +
              $"&scope=user-read-private%20user-read-email%20playlist-modify-public%20playlist-modify-private%20playlist-read-private%20playlist-read-collaborative%20user-read-currently-playing%20user-read-playback-state" +
              $"&show_dialog=true";

    return Results.Redirect(url);
});

app.MapGet("/callback", async (HttpRequest request) =>
{
    var code = request.Query["code"].ToString();
    var state = request.Query["state"].ToString();
    var error = request.Query["error"].ToString();

    State currentState = JsonSerializer.Deserialize<State>(state);

    if (!string.IsNullOrEmpty(error))
    {
        return Results.Redirect(currentState.ReturnTo + $"?error={Uri.EscapeDataString(error)}");
    }

    var clientId = Environment.GetEnvironmentVariable("SPOTIFY_CLIENT_ID");
    var clientSecret = Environment.GetEnvironmentVariable("SPOTIFY_CLIENT_SECRET");
    var redirectUri = Environment.GetEnvironmentVariable("SPOTIFY_REDIRECT_URI");

    var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "https://accounts.spotify.com/api/token");
    var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
    tokenRequest.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
    tokenRequest.Content = new FormUrlEncodedContent(new[]
    {
        new KeyValuePair<string, string>("grant_type", "authorization_code"),
        new KeyValuePair<string, string>("code", code),
        new KeyValuePair<string, string>("redirect_uri", redirectUri ?? "")
    });

    var response = await APIManager.client.SendAsync(tokenRequest);
    var content = await response.Content.ReadAsStringAsync();
    if (!response.IsSuccessStatusCode)
    {
        return Results.Content(content, "application/json");
    }

    var doc = JsonDocument.Parse(content);

    var userAccessToken = doc.RootElement.GetProperty("access_token").GetString() ?? "";
    var userRefreshToken = doc.RootElement.GetProperty("refresh_token").GetString() ?? "";

    APIManager.client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", userAccessToken);

    var responseMe = APIManager.client.GetAsync("https://api.spotify.com/v1/me/");
    var responseMessage = await responseMe;


    if (responseMessage.StatusCode.ToString() == "OK")
    {
        var profileContent = await responseMessage.Content.ReadAsStringAsync();

        var profileElement = JsonSerializer.Deserialize<JsonElement>(profileContent);

        DateTime expirationTime;
        if (profileElement.TryGetProperty("expires_in", out JsonElement expiresElem) && expiresElem.ValueKind == JsonValueKind.Number)
        {
            var expiresIn = expiresElem.GetInt32();
            expirationTime = DateTime.UtcNow.AddSeconds(expiresIn);
        }
        else
        {
            // default to 1 hour if server doesn't provide expires_in
            expirationTime = DateTime.UtcNow.AddMinutes(60);
        }

        Admin newUser = new()
        {
            displayName = profileElement.GetProperty("display_name").GetString() ?? "",
            email = profileElement.GetProperty("email").GetString() ?? "",
            userAccessToken = userAccessToken,
            userRefreshToken = userRefreshToken,
            accessTokenExpiresAt = expirationTime
        };

        if (PlaylistManager.Admins.ContainsKey(currentState.User))
        {
            PlaylistManager.Admins[currentState.User] = newUser;
        }
        else
        {
            PlaylistManager.Admins.Add(currentState.User, newUser);
        }

        RefreshAccessTokenPeriodically();

    }
    return Results.Redirect(currentState.ReturnTo);
});

app.MapGet("/logout/{user}", async (string user) =>
{
    string userEmail = PlaylistManager.Admins.ContainsKey(user) && PlaylistManager.Admins[user] != null ? PlaylistManager.Admins[user].email : "unknown";
    if (PlaylistManager.settings.masterAdminId != null
        && PlaylistManager.Admins[PlaylistManager.settings.masterAdminId].email == userEmail
        && PlaylistManager.Admins.Values.Count(a => a.email == userEmail) == 1)
    {
        PlaylistManager.settings.masterAdminId = null;
    }
    PlaylistManager.Admins[user] = null;

    var response = await APIManager.client.GetAsync("https://accounts.spotify.com/en/logout ");
});

app.MapGet("/me/{user}", async (string user = "") =>
{
    if (PlaylistManager.Admins.ContainsKey(user))
    {
        return Results.Content(JsonSerializer.Serialize(PlaylistManager.Admins[user]), "application/json");
    }
    return Results.Json(new { error = "User not found" });
});

app.MapGet("/me/{user}/playlists", async (string user) =>
{
    if (!PlaylistManager.Admins.ContainsKey(user))
    {
        return Results.Json(new { error = "User not found" });
    }

    await APIManager.AccessToken();

    APIManager.client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", PlaylistManager.Admins[user].userAccessToken);

    var response = await APIManager.client.GetAsync("https://api.spotify.com/v1/me/playlists");
    var JsonObjectResponse = JsonSerializer.Deserialize<JsonObject>(await response.Content.ReadAsStringAsync());

    // JsonObjectResponse.TryGetPropertyValue("items", out JsonObject playlists);
    var playlists = (JsonArray)JsonObjectResponse["items"];

    List<PlaylistData> playlistDatas = new();


    foreach (JsonObject playlist in playlists)
    {
        PlaylistData currentPlaylist = new();

        playlist.TryGetPropertyValue("id", out JsonNode newId);
        currentPlaylist.Id = newId.ToString();
        playlist.TryGetPropertyValue("name", out JsonNode newName);
        currentPlaylist.Name = newName.ToString();
        playlist.TryGetPropertyValue("images", out JsonNode newImages);
        JsonObject image;
        if (newImages != null)
        {
            image = (JsonObject)newImages[newImages.AsArray().Count() - 1];

            image.TryGetPropertyValue("url", out JsonNode imgUrl);
            currentPlaylist.ImgUrl = imgUrl.ToString();
        }

        playlistDatas.Add(currentPlaylist);
    }

    return Results.Content(JsonSerializer.Serialize(playlistDatas), "application/json");
});

app.MapGet("/me/{user}/queue", async (string user) =>
{
    if (!PlaylistManager.Admins.ContainsKey(user))
    {
        return Results.Json(new { error = "User not found" });
    }

    await APIManager.AccessToken();

    APIManager.client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", PlaylistManager.Admins[user].userAccessToken);

    var response = await APIManager.client.GetAsync("https://api.spotify.com/v1/me/player/queue");
    var JsonObjectResponse = JsonSerializer.Deserialize<JsonObject>(await response.Content.ReadAsStringAsync());
    JsonObjectResponse.TryGetPropertyValue("queue", out var queue);
    List<SongData> queueSongs = new();
    foreach (var song in queue.AsArray())
    {
        SongData songData = APIManager.filterSongData(JsonSerializer.Deserialize<JsonElement>(song));
        queueSongs.Add(songData);
    }

    return Results.Json(queueSongs);
});

app.MapGet("/admin/queue", async () =>
{
    if (PlaylistManager.settings.masterAdminId == null)
    {
        return Results.Json(new { error = "No master admin set" });
    }

    await APIManager.AccessToken();

    APIManager.client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", PlaylistManager.Admins[PlaylistManager.settings.masterAdminId].userAccessToken);

    var response = await APIManager.client.GetAsync("https://api.spotify.com/v1/me/player/queue");
    var JsonObjectResponse = JsonSerializer.Deserialize<JsonObject>(await response.Content.ReadAsStringAsync());
    JsonObjectResponse.TryGetPropertyValue("queue", out var queue);
    List<SongData> queueSongs = new();
    if (queue == null)
    {
        return Results.Json(new { error = "No songs in queue" });
    }
    foreach (var song in queue.AsArray())
    {
        SongData songData = APIManager.filterSongData(JsonSerializer.Deserialize<JsonElement>(song));
        queueSongs.Add(songData);
    }

    return Results.Json(queueSongs);
});

app.MapGet("/admin/currently-playing", async () =>
{
    if (PlaylistManager.settings.masterAdminId == null)
    {
        return Results.Json(new { error = "No master admin set" });
    }

    await APIManager.AccessToken();

    APIManager.client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", PlaylistManager.Admins[PlaylistManager.settings.masterAdminId].userAccessToken);

    var response = await APIManager.client.GetAsync("https://api.spotify.com/v1/me/player/currently-playing");
    if ((int)response.StatusCode != 204)
    {

        var JsonObjectResponse = JsonSerializer.Deserialize<JsonObject>(await response.Content.ReadAsStringAsync());
        JsonObjectResponse.TryGetPropertyValue("is_playing", out var isPlaying);
        if (isPlaying.ToString() == "true")
        {
            JsonObjectResponse.TryGetPropertyValue("item", out var songData);
            SongData currentSong = APIManager.filterSongData(JsonSerializer.Deserialize<JsonElement>(songData));
            JsonObjectResponse.TryGetPropertyValue("progress_ms", out var progressJsonNode);
            int duration = (int)songData["duration_ms"];
            int progress = (int)progressJsonNode;
            int timeRemaining = duration - (int)progressJsonNode;
            return Results.Json(new { currentSong, progress, duration, timeRemaining });
        }
        else
        {
            return Results.Json(new { error = "User is not playing music" });
        }
    }
    else
    {
        return Results.Json(new { error = "User is not playing music" });
    }
});

app.MapGet("/me/{user}/currently-playing", async (string user) =>
{
    if (!PlaylistManager.Admins.ContainsKey(user))
    {
        return Results.Json(new { error = "User not found" });
    }

    await APIManager.AccessToken();

    APIManager.client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", PlaylistManager.Admins[user].userAccessToken);

    var response = await APIManager.client.GetAsync("https://api.spotify.com/v1/me/player/currently-playing");
    if ((int)response.StatusCode != 204)
    {

        var JsonObjectResponse = JsonSerializer.Deserialize<JsonObject>(await response.Content.ReadAsStringAsync());
        JsonObjectResponse.TryGetPropertyValue("is_playing", out var isPlaying);
        if (isPlaying.ToString() == "true")
        {
            JsonObjectResponse.TryGetPropertyValue("item", out var songData);
            SongData currentSong = APIManager.filterSongData(JsonSerializer.Deserialize<JsonElement>(songData));
            JsonObjectResponse.TryGetPropertyValue("progress_ms", out var progressJsonNode);
            int duration = (int)songData["duration_ms"];
            int progress = (int)progressJsonNode;
            int timeRemaining = duration - (int)progressJsonNode;
            return Results.Json(new { currentSong, progress, duration, timeRemaining });
        }
        else
        {
            return Results.Json(new { error = "User is not playing music" });
        }
    }
    else
    {
        return Results.Json(new { error = "User is not playing music" });
    }
});






app.MapGet("/song/{songID}", async (HttpContext http) =>
{
    var songID = http.Request.RouteValues["songID"]?.ToString() ?? "";
    var song = await APIManager.GetSong(songID);
    if (song == null)
    {
        return Results.Json(new { error = "Song not found" });
    }
    return Results.Json(song);
});

app.MapGet("/search/{query}", async (string query) =>
{
    APIManager.accessToken = await APIManager.AccessToken();
    APIManager.client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", APIManager.accessToken);

    using var response = await APIManager.client.GetAsync($"https://api.spotify.com/v1/search?q={Uri.EscapeDataString(query)}&type=track&limit=10");
    if (!response.IsSuccessStatusCode)
        return Results.Json(new { error = "search failed", status = response.StatusCode });

    var content = await response.Content.ReadAsStringAsync();
    var jsonObject = JsonSerializer.Deserialize<JsonElement>(content);
    var jsonObjectTracks = jsonObject.GetProperty("tracks").GetProperty("items");
    var listOfTracks = new List<SongData>();
    string blacklistJson = File.ReadAllText("blacklist.json");
    string[] blacklist = JsonSerializer.Deserialize<string[]>(blacklistJson);
    foreach (var songElem in jsonObjectTracks.EnumerateArray())
    {
        var sd = APIManager.filterSongData(songElem);

        if (sd != null && !blacklist.Contains(sd.id))
        {
            listOfTracks.Add(sd);
        }
    }
    return Results.Json(listOfTracks);
});

app.MapGet("/admin/get-admins/{deviceId}", (string deviceId) =>
{
    var masterAdminId = PlaylistManager.settings.masterAdminId;
    var masterAdmin = masterAdminId != null && PlaylistManager.Admins.ContainsKey(masterAdminId) 
        ? PlaylistManager.Admins[masterAdminId] 
        : null;

    var allAdmins = PlaylistManager.Admins
        .Where(kvp => kvp.Value != null)
        .ToList();

    var uniqueAdmins = allAdmins
        .DistinctBy(kvp => kvp.Value.email)
        .Select(kvp => new { deviceId = kvp.Key, admin = kvp.Value })
        .ToList();

    // Find the current device admin
    var currentDeviceAdmin = allAdmins.FirstOrDefault(kvp => kvp.Key == deviceId);

    // Build result with preference: current device > master admin > others
    var result = new List<dynamic>();
    var addedEmails = new HashSet<string>();

    // Add current device first (if exists and not null)
    if (currentDeviceAdmin.Value != null)
    {
        result.Add(new
        {
            deviceId = currentDeviceAdmin.Key,
            displayName = currentDeviceAdmin.Value.displayName + " (This Device)"
        });
        addedEmails.Add(currentDeviceAdmin.Value.email);
    }

    // Add master admin if different email or if same email but different deviceId
    if (masterAdmin != null && !addedEmails.Contains(masterAdmin.email))
    {
        result.Add(new
        {
            deviceId = masterAdminId,
            displayName = masterAdmin.displayName
        });
        addedEmails.Add(masterAdmin.email);
    }

    // Add remaining unique admins
    foreach (var admin in uniqueAdmins.Where(a => !addedEmails.Contains(a.admin.email)))
    {
        result.Add(new
        {
            deviceId = admin.deviceId,
            displayName = admin.admin.displayName
        });
        addedEmails.Add(admin.admin.email);
    }

    return Results.Json(result);
});










app.MapGet("/request-song/{user}/{songID}", async (string user, string songID) =>
{
    SongData song;
    var songData = await APIManager.GetSong(songID);
    if (songData == null)
    {
        return Results.Json(new { error = "Song not found" });
    }
    song = songData;
    lock (PlaylistManager.RequestedSongs)
    {
        if (PlaylistManager.RequestedSongs.ContainsKey(user))
        {
            PlaylistManager.RequestedSongs[user].Add(song);
        }
        else
        {
            PlaylistManager.RequestedSongs.Add(user, new() { song });

        }
    }
    lock (PlaylistManager.AllSongs)
    {
        if (PlaylistManager.AllSongs.Where(s => s.id == songID).Count() == 0)
        {
            PlaylistManager.AllSongs.Add(song);
        }
    }

    BroadcastEvent("request-song");

    return Results.Json(new { songID, requests = PlaylistManager.getSongRequestCount(songID) });
});

app.MapGet("/remove-song/{user}/{songId}", async (string user, string songId) =>
{
    await removeSongAsync(user, songId);
    BroadcastEvent("remove-song");


    return Results.Json(new { user, status = "removed" });
});


app.MapGet("/clear-requests", async () =>
{
    PlaylistManager.RequestedSongs.Clear();
    PlaylistManager.AllSongs.Clear();

    BroadcastEvent("clear-requests");

    return Results.Json(new { status = "cleared" });
});



app.MapGet("/playlist/{playlistId}/{user}/add-song/{songId}", async (string playlistId, string user, string songId) =>
{
    await APIManager.addSongToPlaylistAsync(playlistId, user, songId);
});








app.MapGet("/get-user-requests/{user}", (string user) =>
{

    if (!PlaylistManager.RequestedSongs.ContainsKey(user))
    {
        return Results.Json(new { statusCode = "User Not found" });
    }
    return Results.Json(PlaylistManager.RequestedSongs[user].OrderBy(s => s.timeRequested));
});

app.MapGet("/requested-songs", async () =>
{
    return PlaylistManager.AllSongs.OrderBy(s => s.requestCount).Reverse();
});

app.MapPost("/store-settings/{user}", async (string user, Settings settings) =>
{
    if (PlaylistManager.Admins.ContainsKey(user) && PlaylistManager.Admins[user] != null)
    {
        // If incoming settings are identical to current settings, skip processing and broadcasting
        bool settingsEqual =
            PlaylistManager.settings.currentPlaylist == settings.currentPlaylist
            && PlaylistManager.settings.numbOfAllowedRequests == settings.numbOfAllowedRequests
            && PlaylistManager.settings.allowRepeats == settings.allowRepeats
            && PlaylistManager.settings.autoAdd == settings.autoAdd
            && PlaylistManager.settings.autoAddTime == settings.autoAddTime
            && PlaylistManager.settings.selectedDays.Count == settings.selectedDays.Count
            && PlaylistManager.settings.selectedDays.All(kv => settings.selectedDays.ContainsKey(kv.Key) && settings.selectedDays[kv.Key] == kv.Value)
            && PlaylistManager.settings.masterAdminId == settings.masterAdminId;

        if (settingsEqual)
        {
            return Results.Ok(PlaylistManager.settings);
        }
        bool limitDecreased = PlaylistManager.settings.numbOfAllowedRequests > settings.numbOfAllowedRequests;
        bool allowRepeatsChanged = PlaylistManager.settings.allowRepeats != settings.allowRepeats;

        PlaylistManager.settings.masterAdminId = settings.masterAdminId;
        PlaylistManager.settings.currentPlaylist = settings.currentPlaylist;
        PlaylistManager.settings.numbOfAllowedRequests = settings.numbOfAllowedRequests;
        PlaylistManager.settings.allowRepeats = settings.allowRepeats;
        PlaylistManager.settings.autoAdd = settings.autoAdd;

        // Notify the PlaylistManager signal about the change to autoAdd so the background
        // worker can block/unblock immediately without busy-waiting.
        PlaylistManager.SignalAutoAddEnabled(settings.autoAdd);

        foreach (var day in settings.selectedDays)
        {
            PlaylistManager.settings.selectedDays[day.Key] = day.Value;
        }

        PlaylistManager.settings.autoAddTime = settings.autoAddTime;

        if (limitDecreased || allowRepeatsChanged)
        {
            foreach (var newUser in PlaylistManager.Admins.Keys)
            {
                if (PlaylistManager.RequestedSongs.ContainsKey(newUser))
                {
                    // var requestedSongs = PlaylistManager.RequestedSongs[newUser];
                    if (limitDecreased)
                    {
                        while (PlaylistManager.RequestedSongs[newUser].Count > settings.numbOfAllowedRequests)
                        {
                            string songId = PlaylistManager.RequestedSongs[newUser][PlaylistManager.RequestedSongs[newUser].Count - 1].id;
                            await removeSongAsync(newUser, songId, false);
                        }
                    }

                    if (allowRepeatsChanged && !settings.allowRepeats)
                    {
                        var uniqueSongs = PlaylistManager.RequestedSongs[newUser].DistinctBy(s => s.id).ToList();
                        PlaylistManager.RequestedSongs[newUser] = uniqueSongs;
                    }

                }
            }
        }

        BroadcastEvent("store-settings");
        // Notify the auto-add loop to restart its wait when settings change
        PlaylistManager.CancelAndResetAutoAdd();

        var autoAddTask = Task.Run(async () =>
        {
            if (settings.autoAdd)
            {

            }
        });

        return Results.Ok(PlaylistManager.settings);
    }
    return Results.Unauthorized();
});
app.MapGet("/get-settings/", () =>
{
    var settings = PlaylistManager.settings;
    var masterAdminId = settings.masterAdminId;
    var masterAdminDisplayName = masterAdminId != null && PlaylistManager.Admins.ContainsKey(masterAdminId) && PlaylistManager.Admins[masterAdminId] != null
        ? PlaylistManager.Admins[masterAdminId].displayName
        : null;
    
    return Results.Json(new
    {
        settings.currentPlaylist,
        masterAdmin = masterAdminId != null ? new { deviceId = masterAdminId, displayName = masterAdminDisplayName } : null,
        settings.numbOfAllowedRequests,
        settings.allowRepeats,
        settings.autoAdd,
        settings.autoAddTime,
        settings.selectedDays
    });
});

// Debug endpoint: view debounced broadcast statistics
app.MapGet("/debug/broadcast-stats", () =>
{
    var countsSnapshot = broadcastCounts.ToDictionary(kv => kv.Key, kv => kv.Value);
    var queued = broadcastQueue.ToArray();
    return Results.Json(new
    {
        counts = countsSnapshot,
        queueLength = queued.Length,
        queued = queued
    });
});

// Debug endpoint: reset counts/queue
app.MapPost("/debug/broadcast-stats/reset", () =>
{
    broadcastCounts.Clear();
    while (broadcastQueue.TryDequeue(out _)) { }
    return Results.Json(new { status = "reset" });
});

// PlaylistManager.autoAddFunction is now started by the hosted service `AutoAddService`.

app.Run();
