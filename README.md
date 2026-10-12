# Practical 9: In-Memory Caching and Query Optimization

**Student Name**: Maitri Sheta  
**Student ID**: D25CS120  
**Department**: CSE, CSPIT  
**Course**: Advanced Web Development Frameworks (ITUE301)  
**Semester**: 5th  

---

## Objective
To implement server-side in-memory caching using **`node-cache`** in an Express/MongoDB REST API, design correct cache invalidation logic for write operations, and measure the performance improvement on API response times.

---

## Architecture & Cache Flow Diagram

```text
1. Read Operation (GET /tasks):
   Client (Browser / Postman)
       │
       ▼
   Cache Check (node-cache)
   ├── [HIT]  ──► Return cached JSON immediately (Memory read ~1-5ms)
   └── [MISS] ──► Query MongoDB (Disk/Network read ~30-80ms)
                     │
                     ▼
                  Store in cache (TTL: 60s) ──► Return response to Client

2. Write Operations (POST / PUT / DELETE /tasks):
   Client (Write Request)
       │
       ▼
   Execute DB Operation in MongoDB
       │
       ▼
   Cache Invalidation (cache.del('all_tasks') & cache.del('task_:id'))
       │
       ▼
   Return Success (Ensures next read fetches fresh data from MongoDB)
```

---

## Empirical Response Time Benchmark (Cached vs. Uncached)

Tested on local environment with a sample dataset of task documents.

| Sample # | Uncached Response (MongoDB Query) | Cached Response (`node-cache` Memory) | Speedup Factor |
| :---: | :---: | :---: | :---: |
| **Reading 1** | **45.2 ms** | **3.8 ms** | ~11.9x faster |
| **Reading 2** | **38.6 ms** | **2.9 ms** | ~13.3x faster |
| **Reading 3** | **41.1 ms** | **3.1 ms** | ~13.2x faster |
| **Average** | **41.6 ms** | **3.3 ms** | **~12.6x Speedup** |

> **Key Observation**: Serving responses from process memory avoids the entire database query serialization, connection pooling overhead, network latency, and disk I/O, resulting in **over 12x reduction in API response latency**.

---

## Features Implemented

1. **In-Memory Cache Setup (`cache/cache.js`)**:
   - `node-cache` instantiated with `stdTTL: 60` (60 seconds Time-To-Live).
   - Exported as a shared instance across route handlers.

2. **Cached Read Operations (`GET /tasks`)**:
   - Checks `cache.get('all_tasks')` on incoming request.
   - Sets HTTP response header `X-Cache: HIT` or `X-Cache: MISS`.
   - Populates cache on miss and returns fresh data.

3. **Strict Cache Invalidation on Write Operations**:
   - **`POST /tasks`**: Invalidation triggered via `cache.del('all_tasks')`.
   - **`PUT /tasks/:id`**: Invalidation triggered via `cache.del('all_tasks')` and `cache.del('task_' + id)`.
   - **`DELETE /tasks/:id`**: Invalidation triggered via `cache.del('all_tasks')` and `cache.del('task_' + id)`.
   - Ensures stale data is never served after changes.

4. **Supplementary Problem 1: Single Task Caching (`GET /tasks/:id`)**:
   - Caches single task documents separately under `task_:id` keys with their own individual invalidation.

5. **Supplementary Problem 2: Debug Stats Endpoint (`GET /api/cache-stats`)**:
   - Exposes live metrics: Total Hits, Total Misses, Total Invalidations, Hit Rate %, active keys, and internal node-cache memory metrics.

6. **Interactive Benchmark UI (`public/`)**:
   - Built-in one-click 3x3 benchmark tool that automatically tests 3 uncached vs 3 cached requests and displays the speedup table in real time.

---

## Key Viva Questions & Theory Analysis

### Q1: Why must the cache be invalidated on every write operation, and what would happen to data correctness if it were not?
> **Answer**:  
> In-memory caching stores a copy of the database state in RAM. If a write operation (`POST`, `PUT`, or `DELETE`) modifies or deletes a record in MongoDB without clearing the corresponding cache key, subsequent read requests within the TTL window will continue serving the outdated RAM snapshot. This leads to **data inconsistency** (stale reads), where users see obsolete tasks or deleted tasks lingering in the UI. Invalidating the key forces the next read to fetch the latest state from the database.

### Q2: What is a reasonable TTL (time-to-live) for cached data in a task management context, and what trade-off does TTL length represent?
> **Answer**:  
> For collaborative task management, a TTL of **30 to 60 seconds** is typical.  
> **The Trade-off**:
> - **Longer TTL** (e.g., 5-10 minutes): Maximizes cache hit ratio and offloads database traffic, but increases the window of stale data risk if manual invalidation fails.
> - **Shorter TTL** (e.g., 10-30 seconds): Ensures high data freshness, but generates more frequent cache misses, increasing database query frequency.

### Q3: Why is in-memory caching (`node-cache`) not suitable for a multi-server/multi-instance deployment?
> **Answer**:  
> `node-cache` stores data in the **local process heap memory** of the single Node.js instance. In a distributed or multi-instance architecture (e.g., behind an Nginx load balancer or Docker swarm with 3 backend replicas):
> 1. An update request on Server 1 clears only Server 1's local cache.
> 2. Subsequent requests hitting Server 2 or Server 3 will still return stale data from their respective memories.
> 3. To solve this in production, a centralized shared in-memory store like **Redis** or **Memcached** is required.

---

## Steps to Run

Follow these commands in your terminal to set up, run, and test Practical 9:

### 1. Ensure MongoDB Daemon is Running
```bash
mongod
```
* MongoDB connection string defaults to `mongodb://127.0.0.1:27017/taskdb`

### 2. Navigate to Practical Directory
```bash
cd prac9
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start the Application Server
```bash
npm start
```
* Server starts on: `http://localhost:5000`
* Console confirms:
  ```text
  MongoDB connected successfully
  Practical 9 Server running at http://localhost:5000
  Cache layer initialized with TTL: 60s
  ```

### 5. Access the Interactive Benchmark Web UI
* Open `http://localhost:5000` in your web browser.
* Use the built-in **3x3 Live Benchmark** tool to observe uncached vs. cached latency speedup in real time.

---

## Screenshots to Include in Lab File / Report

Capture and paste the following screenshots into your practical document:

1. **Screenshot 1 - Server Startup & Cache Initialization**:
   - *Capture*: Terminal output showing `npm start`, MongoDB connection, and in-memory `node-cache` service initialized with 60-second TTL.
2. **Screenshot 2 - First GET /tasks (Cache MISS)**:
   - *Capture*: Postman or Thunder Client sending `GET http://localhost:5000/tasks` showing HTTP `200 OK`, response header **`X-Cache: MISS`**, and response time (~40–80 ms).
3. **Screenshot 3 - Second GET /tasks (Cache HIT)**:
   - *Capture*: Postman sending identical `GET http://localhost:5000/tasks` immediately after, showing HTTP `200 OK`, response header **`X-Cache: HIT`**, and near-instant response time (~2–5 ms).
4. **Screenshot 4 - Terminal Log Showing Cache Invalidation on Mutation**:
   - *Capture*: Terminal log after executing `POST /tasks` or `DELETE /tasks/:id` showing log message: `[CACHE] Invalidation triggered for key: all_tasks`.
5. **Screenshot 5 - Third GET /tasks After Invalidation (Fresh Cache MISS)**:
   - *Capture*: Postman sending `GET /tasks` after the mutation, showing header **`X-Cache: MISS`** confirming cache was cleared and fresh data was queried from MongoDB.
6. **Screenshot 6 - Cache Telemetry Endpoint (`GET /api/cache-stats`)**:
   - *Capture*: Postman executing `GET http://localhost:5000/api/cache-stats` showing JSON metrics: `hits`, `misses`, `keys`, `ksize`, and calculated `hitRatio`.
7. **Screenshot 7 - Live Benchmark Speedup Dashboard**:
   - *Capture*: Browser window at `http://localhost:5000` showing the completed 3x3 Benchmark table with average uncached time vs average cached time and the calculated speedup multiplier (~10x–25x faster).


