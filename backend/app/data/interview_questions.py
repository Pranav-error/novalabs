"""Static question bank for the AI mock interview feature.

Each topic maps to a list of question dicts:
    {
        "id": unique string id,
        "question": the question asked to the learner,
        "keywords": lowercase keywords/phrases used for scoring,
        "model_answer": a concise ideal answer shown after submission,
    }
"""

QUESTION_BANK: dict[str, list[dict]] = {
    "html_css": [
        {
            "id": "html_1",
            "question": "What is semantic HTML and why does it matter?",
            "keywords": ["semantic", "meaning", "header", "nav", "article", "accessibility", "screen reader", "seo"],
            "model_answer": (
                "Semantic HTML means using elements that describe the meaning of their content, like <header>, "
                "<nav>, <article> and <footer>, instead of generic <div>s. It matters because screen readers and "
                "search engines rely on this structure, improving accessibility and SEO. It also makes the code "
                "easier for other developers to read and maintain."
            ),
        },
        {
            "id": "html_2",
            "question": "Explain the CSS box model.",
            "keywords": ["content", "padding", "border", "margin", "box-sizing", "width", "height", "border-box"],
            "model_answer": (
                "Every element is a rectangular box made of four layers: the content, padding around the content, "
                "the border, and the margin outside the border. By default, width and height apply only to the "
                "content box, but setting box-sizing: border-box makes them include padding and border, which is "
                "usually easier to reason about in layouts."
            ),
        },
        {
            "id": "html_3",
            "question": "When would you use Flexbox versus CSS Grid?",
            "keywords": ["flexbox", "grid", "one dimension", "row", "column", "two dimension", "layout", "align"],
            "model_answer": (
                "Flexbox is designed for one-dimensional layouts, arranging items along a single row or column, so "
                "it is great for navbars, toolbars and centering content. CSS Grid is two-dimensional, letting you "
                "control rows and columns at the same time, which suits full page layouts and card grids. In "
                "practice they combine well: Grid for the overall page and Flexbox inside individual components."
            ),
        },
        {
            "id": "html_4",
            "question": "How does CSS specificity work when multiple rules target the same element?",
            "keywords": ["specificity", "inline", "id", "class", "element", "important", "cascade", "selector"],
            "model_answer": (
                "When rules conflict, the browser picks the most specific selector: inline styles beat IDs, IDs "
                "beat classes and attributes, and classes beat plain element selectors. If specificity is equal, "
                "the rule that appears last in the cascade wins. !important overrides normal rules but should be "
                "avoided because it makes styles hard to maintain."
            ),
        },
        {
            "id": "html_5",
            "question": "What is responsive design and how do media queries help achieve it?",
            "keywords": ["responsive", "media quer", "breakpoint", "viewport", "mobile", "screen size", "min-width", "flexible"],
            "model_answer": (
                "Responsive design means a site adapts its layout to different screen sizes, from phones to "
                "desktops. Media queries apply CSS only when conditions like min-width or max-width match, letting "
                "you define breakpoints where the layout changes. Combined with fluid units, flexible images and "
                "the viewport meta tag, this gives one codebase that works everywhere, often built mobile-first."
            ),
        },
        {
            "id": "html_6",
            "question": "What are pseudo-classes in CSS? Give some examples.",
            "keywords": ["pseudo-class", "hover", "focus", "state", "nth-child", "first-child", "active", "visited"],
            "model_answer": (
                "A pseudo-class selects elements based on their state or position rather than a class attribute, "
                "written with a single colon like :hover. Common examples are :hover and :active for mouse "
                "interaction, :focus for keyboard and form accessibility, and structural ones like :first-child "
                "and :nth-child(2n) to style elements by their position in the DOM."
            ),
        },
        {
            "id": "html_7",
            "question": "Explain the different values of the CSS position property.",
            "keywords": ["static", "relative", "absolute", "fixed", "sticky", "offset", "ancestor", "viewport", "normal flow"],
            "model_answer": (
                "Static is the default: elements sit in the normal flow and ignore offsets. Relative keeps the "
                "element in flow but lets you nudge it with top/left, and it becomes a positioning ancestor. "
                "Absolute removes the element from the flow and positions it against the nearest positioned "
                "ancestor, fixed pins it to the viewport, and sticky behaves like relative until a scroll "
                "threshold is reached, then sticks like fixed."
            ),
        },
        {
            "id": "html_8",
            "question": "What are some basic practices to make a web page accessible?",
            "keywords": ["alt", "aria", "contrast", "keyboard", "label", "semantic", "screen reader", "heading"],
            "model_answer": (
                "Start with semantic HTML and a logical heading hierarchy so screen readers can navigate the page. "
                "Provide alt text for images, associate labels with form inputs, and ensure sufficient colour "
                "contrast. Make sure everything is usable with a keyboard alone, and use ARIA attributes only when "
                "native HTML elements cannot express the behaviour."
            ),
        },
    ],
    "react": [
        {
            "id": "react_1",
            "question": "What are components and props in React?",
            "keywords": ["component", "props", "reusable", "function", "parent", "child", "read-only", "ui"],
            "model_answer": (
                "Components are reusable, self-contained pieces of UI, usually written as functions that return "
                "JSX. Props are the inputs a parent passes to a child component, similar to function arguments. "
                "Props are read-only, so a child never modifies them directly; data flows one way from parent to "
                "child, which keeps the UI predictable."
            ),
        },
        {
            "id": "react_2",
            "question": "How does the useState hook work?",
            "keywords": ["usestate", "state", "re-render", "setter", "initial", "hook", "immutable", "update"],
            "model_answer": (
                "useState declares a piece of state inside a function component and returns the current value plus "
                "a setter function. Calling the setter schedules a re-render with the new value; you never mutate "
                "state directly. The argument to useState is only the initial value, used on the first render, and "
                "for updates based on the previous value you pass a function like setCount(c => c + 1)."
            ),
        },
        {
            "id": "react_3",
            "question": "What is useEffect and what role does its dependency array play?",
            "keywords": ["useeffect", "side effect", "dependency", "mount", "cleanup", "render", "fetch", "empty array"],
            "model_answer": (
                "useEffect runs side effects like data fetching, subscriptions or timers after the component "
                "renders. The dependency array controls when it re-runs: with an empty array it runs once on "
                "mount, with dependencies it re-runs whenever one of them changes, and with no array it runs after "
                "every render. Returning a cleanup function lets you unsubscribe or clear timers before the next "
                "run or on unmount."
            ),
        },
        {
            "id": "react_4",
            "question": "Explain the virtual DOM and how React uses reconciliation.",
            "keywords": ["virtual dom", "diff", "reconciliation", "real dom", "re-render", "update", "performance", "tree"],
            "model_answer": (
                "The virtual DOM is a lightweight in-memory representation of the real DOM. When state changes, "
                "React builds a new virtual tree and diffs it against the previous one in a process called "
                "reconciliation. It then applies only the minimal set of changes to the real DOM, which is much "
                "faster than re-rendering the whole page because real DOM operations are expensive."
            ),
        },
        {
            "id": "react_5",
            "question": "Why do list items in React need a key prop, and why is using the array index discouraged?",
            "keywords": ["key", "list", "identity", "index", "reconciliation", "unique", "reorder", "state"],
            "model_answer": (
                "Keys give each list item a stable identity so React can match items between renders during "
                "reconciliation, updating only what changed. Using the array index as a key breaks when items are "
                "inserted, removed or reordered, because the same index then points at a different item, causing "
                "wrong state and unnecessary re-renders. A unique, stable id from the data is the right choice."
            ),
        },
        {
            "id": "react_6",
            "question": "What is a controlled component in React forms?",
            "keywords": ["controlled", "value", "onchange", "state", "input", "form", "single source", "uncontrolled"],
            "model_answer": (
                "A controlled component is a form input whose value is driven by React state: the input's value "
                "prop comes from state, and an onChange handler updates that state on every keystroke. This makes "
                "React the single source of truth, so you can validate, format or reset the value easily. An "
                "uncontrolled input, by contrast, keeps its own value in the DOM and is read via a ref."
            ),
        },
        {
            "id": "react_7",
            "question": "What does 'lifting state up' mean and when do you need it?",
            "keywords": ["lifting state", "parent", "shared", "sibling", "props", "common ancestor", "callback", "source of truth"],
            "model_answer": (
                "Lifting state up means moving state from a child component into the closest common ancestor when "
                "two or more components need to share it. The parent owns the state and passes the value down as "
                "props, along with callback functions the children call to update it. This keeps a single source "
                "of truth and lets sibling components stay in sync."
            ),
        },
        {
            "id": "react_8",
            "question": "What are the Rules of Hooks and why do they exist?",
            "keywords": ["top level", "loop", "condition", "order", "custom hook", "function component", "call", "consistent"],
            "model_answer": (
                "Hooks must be called at the top level of a function component or custom hook — never inside "
                "loops, conditions or nested functions — and only from React functions. React tracks hooks by the "
                "order in which they are called on each render, so a conditional call would shift that order and "
                "corrupt the state mapping. Following these rules keeps every render calling the same hooks in the "
                "same sequence."
            ),
        },
    ],
    "python_fastapi": [
        {
            "id": "py_1",
            "question": "What is the difference between path parameters and query parameters in FastAPI?",
            "keywords": ["path", "query", "url", "required", "optional", "default", "type", "resource"],
            "model_answer": (
                "Path parameters are part of the URL itself, like /users/{user_id}, and identify a specific "
                "resource, so they are always required. Query parameters come after the ? in the URL, like "
                "?page=2&limit=10, and are typically used for filtering, sorting or pagination; giving them a "
                "default value makes them optional. FastAPI infers both from your function signature and validates "
                "their types automatically."
            ),
        },
        {
            "id": "py_2",
            "question": "How does Pydantic help with request validation in FastAPI?",
            "keywords": ["pydantic", "basemodel", "validation", "type", "schema", "422", "serializ", "request body"],
            "model_answer": (
                "You declare the shape of a request body as a Pydantic BaseModel with typed fields, and FastAPI "
                "automatically parses and validates incoming JSON against it. If the data is missing fields or has "
                "wrong types, the client gets a detailed 422 error without you writing any validation code. The "
                "same models also power serialization and the auto-generated OpenAPI docs."
            ),
        },
        {
            "id": "py_3",
            "question": "Explain async and await in Python. Why are they useful in web servers?",
            "keywords": ["async", "await", "coroutine", "event loop", "non-blocking", "io", "concurren", "single thread"],
            "model_answer": (
                "async def defines a coroutine, and await pauses it at an I/O operation, handing control back to "
                "the event loop so other tasks can run. This gives concurrency on a single thread without the "
                "overhead of one thread per request. In a web server, most time is spent waiting on databases or "
                "external APIs, so async lets one worker handle many requests at once instead of blocking."
            ),
        },
        {
            "id": "py_4",
            "question": "What is dependency injection in FastAPI and how is Depends used?",
            "keywords": ["depends", "dependency", "inject", "reusable", "database session", "authentication", "shared", "parameter"],
            "model_answer": (
                "Dependency injection means a route declares what it needs — like a database session or the "
                "current user — and FastAPI creates and passes it in automatically. You write a function such as "
                "get_db or get_current_user and reference it with Depends() in the route signature. This keeps "
                "shared logic reusable and testable, since dependencies can be overridden in tests, and "
                "dependencies can themselves depend on other dependencies."
            ),
        },
        {
            "id": "py_5",
            "question": "Explain the meaning of common HTTP status codes an API should return.",
            "keywords": ["200", "201", "400", "401", "403", "404", "422", "500"],
            "model_answer": (
                "2xx codes mean success: 200 OK for reads and updates, 201 Created after making a resource. 4xx "
                "codes mean the client made a mistake: 400 for a bad request, 401 when authentication is missing "
                "or invalid, 403 when the user is authenticated but not allowed, 404 when the resource does not "
                "exist, and 422 for validation errors. 5xx codes like 500 indicate the server itself failed."
            ),
        },
        {
            "id": "py_6",
            "question": "What is middleware in FastAPI and what would you use it for?",
            "keywords": ["middleware", "request", "response", "cors", "logging", "every request", "before", "after"],
            "model_answer": (
                "Middleware is code that runs for every request before it reaches a route and for every response "
                "on the way out. It is ideal for cross-cutting concerns like CORS handling, request logging, "
                "timing headers, compression or attaching a request ID. In FastAPI you add it with "
                "app.add_middleware or the @app.middleware('http') decorator, wrapping the call to the next "
                "handler."
            ),
        },
        {
            "id": "py_7",
            "question": "What is ASGI and what role does Uvicorn play when running a FastAPI app?",
            "keywords": ["asgi", "uvicorn", "server", "wsgi", "async", "protocol", "worker", "interface"],
            "model_answer": (
                "ASGI is the Asynchronous Server"
                " Gateway Interface, the async successor to WSGI, defining how a "
                "Python web framework talks to a web server so it can handle async requests and WebSockets. "
                "FastAPI is an ASGI framework, and Uvicorn is the ASGI server that actually listens on a port, "
                "accepts connections and passes requests into the app. In production you typically run multiple "
                "Uvicorn workers behind a process manager or reverse proxy."
            ),
        },
        {
            "id": "py_8",
            "question": "How do you handle errors in a FastAPI application?",
            "keywords": ["httpexception", "status code", "detail", "exception handler", "raise", "validation", "custom", "try"],
            "model_answer": (
                "For expected errors you raise HTTPException with an appropriate status code and a detail message, "
                "for example 404 when a record is missing, and FastAPI turns it into a JSON error response. For "
                "custom exception types you register handlers with @app.exception_handler to map them to "
                "responses in one place. Validation errors are handled automatically as 422s, and unexpected "
                "exceptions should be logged and returned as a generic 500 without leaking internals."
            ),
        },
    ],
    "mongodb": [
        {
            "id": "mongo_1",
            "question": "What are the main differences between SQL and NoSQL databases?",
            "keywords": ["sql", "nosql", "schema", "relational", "table", "document", "flexible", "scal", "join"],
            "model_answer": (
                "SQL databases store data in tables with a fixed schema, use joins to relate data, and offer "
                "strong ACID guarantees, which suits structured, relational data. NoSQL databases like MongoDB "
                "store flexible documents, collections or key-value pairs without a rigid schema, and are "
                "designed to scale horizontally across servers. The choice depends on how structured your data "
                "is, how it will be queried, and your consistency versus scalability needs."
            ),
        },
        {
            "id": "mongo_2",
            "question": "Explain documents and collections in MongoDB.",
            "keywords": ["document", "collection", "bson", "json", "field", "_id", "table", "row", "schema"],
            "model_answer": (
                "A document is a single record stored as BSON, a binary form of JSON, made of field-value pairs "
                "and identified by a unique _id. A collection is a group of documents, roughly analogous to a "
                "table, while documents are like rows — except documents in the same collection can have "
                "different fields. This flexible structure lets you nest arrays and objects directly inside a "
                "record."
            ),
        },
        {
            "id": "mongo_3",
            "question": "What are indexes in MongoDB and why are they important?",
            "keywords": ["index", "query", "scan", "performance", "b-tree", "compound", "unique", "write", "sort"],
            "model_answer": (
                "An index is a data structure, typically a B-tree, that stores a sorted subset of fields so "
                "queries can find matching documents without scanning the entire collection. Indexes dramatically "
                "speed up reads and sorts on the indexed fields, and unique or compound indexes support "
                "constraints and multi-field queries. The trade-off is that every write must also update the "
                "indexes, so you index the fields you query most, not everything."
            ),
        },
        {
            "id": "mongo_4",
            "question": "When should you embed data in a document versus referencing another collection?",
            "keywords": ["embed", "reference", "relationship", "one-to-many", "duplicate", "grow", "read", "atomic", "lookup"],
            "model_answer": (
                "Embed when related data is read together and belongs to the parent, such as an order and its "
                "line items — one read fetches everything and updates to a single document are atomic. Reference "
                "with an id when the related data is large, shared across many parents, or grows without bound, "
                "like users referenced by thousands of posts, to avoid huge documents and duplication. A good "
                "rule of thumb is: data that is accessed together should be stored together."
            ),
        },
        {
            "id": "mongo_5",
            "question": "What is the aggregation pipeline in MongoDB?",
            "keywords": ["aggregation", "pipeline", "stage", "$match", "$group", "$sort", "transform", "sum", "lookup"],
            "model_answer": (
                "The aggregation pipeline processes documents through a sequence of stages, where each stage "
                "transforms the stream and passes results to the next. Common stages include $match to filter, "
                "$group to compute sums and counts, $sort, $project to reshape fields, and $lookup to join "
                "another collection. It is MongoDB's equivalent of GROUP BY and complex SQL queries, running the "
                "computation inside the database instead of in application code."
            ),
        },
        {
            "id": "mongo_6",
            "question": "Does MongoDB support transactions? How does atomicity work?",
            "keywords": ["transaction", "atomic", "single document", "multi-document", "acid", "session", "commit", "rollback", "replica"],
            "model_answer": (
                "Operations on a single document are always atomic in MongoDB, which is why good schema design "
                "often embeds related data. Since version 4.0, MongoDB also supports multi-document ACID "
                "transactions using sessions, where you can commit or abort a group of operations across "
                "collections. They carry a performance cost, so the best practice is to design schemas so most "
                "changes fit within one document and reserve transactions for cases that truly need them."
            ),
        },
        {
            "id": "mongo_7",
            "question": "What principles guide schema design in MongoDB?",
            "keywords": ["access pattern", "query", "embed", "reference", "denormaliz", "workload", "together", "growth"],
            "model_answer": (
                "Unlike relational design, MongoDB schema design starts from the application's access patterns: "
                "you model documents around how the data is queried, not around normal forms. Data that is read "
                "together is stored together, often via embedding, and denormalizing some duplicate data is "
                "acceptable to make common reads a single query. You also plan for document growth and cardinality "
                "— unbounded arrays or many-to-many relationships usually call for references."
            ),
        },
        {
            "id": "mongo_8",
            "question": "How would you scale a database to handle a growing number of read requests?",
            "keywords": ["replica", "read replica", "shard", "cache", "index", "horizontal", "load", "secondary"],
            "model_answer": (
                "First, make each read cheaper with proper indexes and query optimization, and put a cache like "
                "Redis in front of the database for hot data. Next, add replicas: MongoDB replica sets keep "
                "secondaries in sync, and read preferences can route reads to them, spreading the load. If the "
                "dataset itself outgrows one machine, sharding partitions data horizontally across servers, with "
                "each shard handling a slice of the traffic."
            ),
        },
    ],
    "system_design": [
        {
            "id": "sys_1",
            "question": "Explain the client-server model.",
            "keywords": ["client", "server", "request", "response", "browser", "http", "network", "service"],
            "model_answer": (
                "In the client-server model, a client such as a browser or mobile app sends requests over a "
                "network, and a server processes them and sends back responses, usually over HTTP. The server "
                "centralizes data and business logic so many clients can share it, while clients handle "
                "presentation and user interaction. This separation lets each side scale and evolve "
                "independently, and it underpins virtually every web application."
            ),
        },
        {
            "id": "sys_2",
            "question": "What makes an API RESTful?",
            "keywords": ["rest", "resource", "http method", "get", "post", "stateless", "uri", "json", "status code"],
            "model_answer": (
                "A RESTful API models everything as resources identified by URIs, like /users/42, and manipulates "
                "them with standard HTTP methods: GET to read, POST to create, PUT/PATCH to update and DELETE to "
                "remove. It is stateless — every request carries all the information needed, with no server-side "
                "session — and uses status codes and usually JSON to communicate results. Consistent, "
                "resource-oriented URLs and correct use of methods are what distinguish REST from ad-hoc RPC "
                "endpoints."
            ),
        },
        {
            "id": "sys_3",
            "question": "What is caching and where can it be applied in a web system?",
            "keywords": ["cache", "redis", "browser", "cdn", "ttl", "invalidation", "latency", "expensive", "memory"],
            "model_answer": (
                "Caching stores the result of expensive work in fast storage so repeated requests can be served "
                "without redoing the work, cutting latency and database load. It appears at many layers: the "
                "browser caches static assets, a CDN caches content near users, an in-memory store like Redis "
                "caches database query results, and applications may cache computed values. The hard part is "
                "invalidation — using TTLs or explicit cache busting to avoid serving stale data."
            ),
        },
        {
            "id": "sys_4",
            "question": "What is a load balancer and why do we need one?",
            "keywords": ["load balancer", "distribute", "traffic", "server", "round robin", "health check", "single point", "availab"],
            "model_answer": (
                "A load balancer sits in front of multiple servers and distributes incoming traffic across them, "
                "using strategies like round robin or least connections. It enables horizontal scaling, since you "
                "can add servers behind it, and improves availability by health-checking servers and routing "
                "around failed ones. Without it, a single server becomes both a bottleneck and a single point of "
                "failure."
            ),
        },
        {
            "id": "sys_5",
            "question": "Compare horizontal and vertical scaling.",
            "keywords": ["horizontal", "vertical", "scale out", "scale up", "more servers", "cpu", "limit", "distributed", "stateless"],
            "model_answer": (
                "Vertical scaling (scaling up) means giving one machine more CPU, RAM or disk — it is simple but "
                "hits a hardware ceiling and the machine remains a single point of failure. Horizontal scaling "
                "(scaling out) adds more machines behind a load balancer, which can grow almost without limit and "
                "tolerates individual failures, but requires the application to be distributed-friendly, ideally "
                "stateless. Most large systems scale out for the application tier and use replication or sharding "
                "for data."
            ),
        },
        {
            "id": "sys_6",
            "question": "How would you choose between a SQL and a NoSQL database for a new project?",
            "keywords": ["relational", "consistency", "transaction", "schema", "flexible", "scale", "query", "structure", "acid"],
            "model_answer": (
                "Start from the data and the queries: if the data is highly relational with many joins and needs "
                "strong ACID transactions — payments, inventory, bookings — a SQL database like PostgreSQL is the "
                "safe default. If the schema is flexible or evolving, the data is document- or event-shaped, or "
                "you need massive horizontal write scale, a NoSQL store like MongoDB fits better. Many real "
                "systems mix both, using each where its strengths matter, but for most CRUD apps a relational "
                "database is the sensible starting point."
            ),
        },
        {
            "id": "sys_7",
            "question": "What is a CDN and how does it improve performance?",
            "keywords": ["cdn", "content delivery", "edge", "static", "latency", "geograph", "origin", "cache"],
            "model_answer": (
                "A CDN is a content delivery network — a set of edge servers distributed around the world that "
                "cache your content close to users. When a user requests a static asset like an image, script or "
                "video, the nearest edge server responds instead of your origin server, cutting geographic "
                "latency dramatically. It also absorbs traffic spikes and reduces load and bandwidth on the "
                "origin, and modern CDNs can even cache some dynamic responses."
            ),
        },
        {
            "id": "sys_8",
            "question": "What is rate limiting and why do APIs implement it?",
            "keywords": ["rate limit", "requests", "abuse", "429", "token bucket", "window", "throttl", "fair", "ddos"],
            "model_answer": (
                "Rate limiting caps how many requests a client can make in a time window, for example 100 "
                "requests per minute per API key or IP. It protects the service from abuse, accidental "
                "infinite-loop clients and denial-of-service traffic, and keeps usage fair across customers. "
                "Common algorithms include token bucket and sliding window, and when a client exceeds the limit "
                "the API responds with 429 Too Many Requests, often with a Retry-After header."
            ),
        },
    ],
    "hr_behavioural": [
        {
            "id": "hr_1",
            "question": "Tell me about yourself.",
            "keywords": ["experience", "learn", "project", "skill", "passion", "background", "goal", "build"],
            "model_answer": (
                "A strong answer is a two-minute professional story: who you are, the skills and projects that "
                "define you, and why this role is the logical next step. For example: 'I'm a full-stack developer "
                "who recently completed an intensive program building projects with React and FastAPI; I love "
                "turning ideas into working products, and I'm looking for a team where I can keep learning and "
                "contribute from day one.' Keep it relevant to the job, not a life history."
            ),
        },
        {
            "id": "hr_2",
            "question": "What is your greatest strength, and what is a weakness you are working on?",
            "keywords": ["strength", "weakness", "improve", "example", "learn", "aware", "feedback", "working on"],
            "model_answer": (
                "Pick a genuine strength backed by an example — 'I'm persistent: when a bug blocked our project "
                "for two days, I methodically isolated it and documented the fix for the team.' For the weakness, "
                "choose something real but not disqualifying, and show self-awareness plus action: 'I used to "
                "hesitate to ask for help too long; now I timebox myself and ask after 30 minutes of being "
                "stuck.' The key is honesty paired with visible improvement."
            ),
        },
        {
            "id": "hr_3",
            "question": "Describe a time you had a conflict with a teammate. How did you handle it?",
            "keywords": ["situation", "listen", "communicat", "perspective", "resolve", "team", "result", "compromise", "understand"],
            "model_answer": (
                "Use the STAR structure: describe the situation and task, the action you took, and the result. "
                "For example: a teammate and I disagreed on the tech stack for a group project; I set up a short "
                "call, listened to his reasoning, and we agreed to prototype both approaches for a day before "
                "deciding together. Emphasize listening, focusing on the problem rather than the person, and "
                "ending with a concrete positive outcome for the team."
            ),
        },
        {
            "id": "hr_4",
            "question": "Why should we hire you?",
            "keywords": ["skill", "value", "fit", "contribut", "example", "team", "learn", "motivat", "result"],
            "model_answer": (
                "Connect your skills directly to what the role needs: 'You need someone who can ship full-stack "
                "features — I've built and deployed several projects with exactly your stack, so I can contribute "
                "quickly.' Add what differentiates you, such as how fast you learn or how you communicate, and "
                "back it with a brief example or result. Close with genuine motivation: you want to grow with "
                "this team, not just get any job."
            ),
        },
        {
            "id": "hr_5",
            "question": "How do you handle tight deadlines or pressure at work?",
            "keywords": ["prioriti", "plan", "communicat", "break", "focus", "example", "calm", "deliver", "manage"],
            "model_answer": (
                "Explain your method, then prove it with an example. A good approach: stay calm, break the work "
                "into small tasks, prioritize what truly must ship, and communicate early if the scope or "
                "timeline is at risk rather than surprising anyone at the deadline. For instance, when a project "
                "deadline was moved up a week, I cut nice-to-have features after aligning with the team, focused "
                "on the core flow, and we delivered on time."
            ),
        },
        {
            "id": "hr_6",
            "question": "Tell me about a time you failed. What did you learn from it?",
            "keywords": ["failure", "mistake", "learn", "responsib", "improve", "situation", "result", "change", "grow"],
            "model_answer": (
                "Choose a real failure, own it without blaming others, and spend most of the answer on what "
                "changed afterwards. For example: 'I once underestimated a project and missed a demo deadline "
                "because I didn't flag the delay early. I learned to break work into milestones and give status "
                "updates before problems become emergencies — since then I haven't missed a commitment.' "
                "Interviewers care less about the failure than about your accountability and growth."
            ),
        },
        {
            "id": "hr_7",
            "question": "Give an example of a time you worked successfully in a team.",
            "keywords": ["team", "role", "collaborat", "communicat", "contribut", "situation", "result", "support", "together"],
            "model_answer": (
                "Use STAR and be specific about your role: the situation, what you personally did, and the "
                "measurable result. For example: 'In a four-person group project, I owned the backend API and set "
                "up a shared task board; when a teammate fell behind on the frontend, I paired with her for two "
                "evenings and we still demoed on time.' Highlight communication, reliability and supporting "
                "others — not just your individual output."
            ),
        },
        {
            "id": "hr_8",
            "question": "Where do you see yourself in five years? What are your career goals?",
            "keywords": ["goal", "grow", "learn", "skill", "contribut", "lead", "develop", "plan"],
            "model_answer": (
                "Show ambition that aligns with the company: in the short term you want to master your craft and "
                "become someone the team relies on; over five years you aim to grow into deeper technical "
                "ownership or mentoring others, depending on where you add the most value. Mention concrete "
                "skills you plan to develop, and make clear you see this role as a place to build that path "
                "rather than a stepping stone you'll abandon."
            ),
        },
    ],
}


TOPIC_NAMES: dict[str, str] = {
    "html_css": "Technical (HTML/CSS/JS)",
    "react": "Technical (React)",
    "python_fastapi": "Technical (Python/FastAPI)",
    "mongodb": "Technical (MongoDB & Databases)",
    "system_design": "System Design (Intro)",
    "hr_behavioural": "HR / Behavioural",
}


def get_question(question_id: str) -> dict | None:
    """Look up a question by id across all topics."""
    for questions in QUESTION_BANK.values():
        for q in questions:
            if q["id"] == question_id:
                return q
    return None
