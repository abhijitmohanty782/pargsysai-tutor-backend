import express from "express";
import { CosmosClient } from "@azure/cosmos";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("Tutor backend server is running.");
});

const cosmos = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const db = cosmos.database("tutor"); // Replace with your actual Cosmos DB name
const masterAnswerContainer = db.container("masteranswer"); // match Cosmos container name
const studentAnswerContainer = db.container("studentanswer");
const clusterContainer = db.container("topic_cluster");
const class_clusterContainer = db.container("class_cluster");
const learningMaterialsContainer = db.container("learning_materials");

// GET all master answers

app.get("/api/master-answers", async (req, res) => {
  try {
    const { resources: answers } = await masterAnswerContainer.items
      .query("SELECT * FROM c")
      .fetchAll();

    // console.log("MasterAnswers from DB:", answers);
    res.status(200).json(answers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch master answers" });
  }
});

// GET: Fetch master answer by questionId
app.get("/api/master-answers/:questionId", async (req, res) => {
  const { questionId } = req.params;

  try {
    const { resources: answers } = await masterAnswerContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.questionId = @questionId",
        parameters: [{ name: "@questionId", value: questionId }],
      })
      .fetchAll();

    if (!answers || answers.length === 0) {
      return res.status(404).json({ error: "No master answer found for this questionId" });
    }

    res.status(200).json(answers[0]); // assuming questionId is unique
  } catch (err) {
    console.error("❌ Error fetching master answer:", err);
    res.status(500).json({ error: "Failed to fetch master answer" });
  }
});

// GET: all student answers

app.get("/api/answers", async (req, res) => {
  try {
    const { resources: answers } = await studentAnswerContainer.items
      .query("SELECT * FROM c")
      .fetchAll();

    // console.log("MasterAnswers from DB:", answers);
    res.status(200).json(answers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch master answers" });
  }
});

// POST: Submit new answer

app.post("/api/answers", async (req, res) => {
  try {
    const { questionId, questionText, answerText, subTopic, Topic } = req.body;

    // Optional: Simple validation
    if (!questionId || !questionText || !answerText || !subTopic || !Topic) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // TEMPORARY static userId until auth is added
    const userId = "test-user-01"; // Replace with req.user.id later

    const newAnswer = {
      id: `${userId}-${questionId}`, // composite ID to avoid collisions
      userId,
      questionId,
      questionText,
      answerText,
      subTopic,
      Topic,
    };

    const { resource: savedAnswer } = await studentAnswerContainer.items.create(
      newAnswer
    );

    res.status(201).json(savedAnswer);
  } catch (err) {
    console.error("Error saving student answer:", err);
    res.status(500).json({ error: "Failed to submit student answer" });
  }
});


// GET : API to Get Subjects by Class ID

app.get("/api/class/:classId/subjects", async (req, res) => {
  const { classId } = req.params;
  try {
    const { resources: classes } = await class_clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.id = @classId",
        parameters: [{ name: "@classId", value: classId }],
      })
      .fetchAll();
    const cls = classes[0];

    if (!cls || !cls.subject_ids || cls.subject_ids.length === 0) {
      return res.status(404).json({ error: "Class not found or has no subjects" });
    }

    const { resources: subjects } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
        parameters: [{ name: "@ids", value: cls.subject_ids }],
      })
      .fetchAll();

    res.status(200).json(subjects);
  } catch (err) {
    console.error("❌ Error fetching subjects from class:", err);
    res.status(500).json({ error: "Failed to fetch subjects for class" });
  }
});


// GET : API to Get Domains by Subject ID

app.get("/api/subject/:subjectId/domains", async (req, res) => {
  const { subjectId } = req.params;
  try {
    const { resources: subjects } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.id = @subjectId",
        parameters: [{ name: "@subjectId", value: subjectId }],
      })
      .fetchAll();
    const subject = subjects[0];

    if (!subject || !subject.domain_ids || subject.domain_ids.length === 0) {
      return res.status(404).json({ error: "Subject not found or has no domains" });
    }

    const { resources: domains } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
        parameters: [{ name: "@ids", value: subject.domain_ids }],
      })
      .fetchAll();

    res.status(200).json(domains);
  } catch (err) {
    console.error("❌ Error fetching domains from subject:", err);
    res.status(500).json({ error: "Failed to fetch domains for subject" });
  }
});


// GET : Unit API - Returns full chapter documents from unit ID

app.get("/api/unit/:unitId", async (req, res) => {
  const { unitId } = req.params;
  try {
    const { resources: units } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.id = @unitId",
        parameters: [{ name: "@unitId", value: unitId }],
      })
      .fetchAll();
    const unit = units[0];

    if (!unit || !unit.chapter_ids || unit.chapter_ids.length === 0) {
      return res
        .status(404)
        .json({ error: "Unit not found or has no chapter_ids" });
    }

    const { resources: chapters } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
        parameters: [{ name: "@ids", value: unit.chapter_ids }],
      })
      .fetchAll();

    res.status(200).json(chapters);
  } catch (err) {
    console.error("❌ Error fetching chapters from unit:", err);
    res.status(500).json({ error: "Failed to fetch chapters for unit" });
  }
});

// GET : Chapter API - Returns full topic documents from Chapter ID

app.get("/api/chapter/:chapterId", async (req, res) => {
  const { chapterId } = req.params;
  try {
    const { resources: chapters } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.id = @chapterId",
        parameters: [{ name: "@chapterId", value: chapterId }],
      })
      .fetchAll();
    const chapter = chapters[0];

    if (!chapter || !chapter.topic_ids || chapter.topic_ids.length === 0) {
      return res
        .status(404)
        .json({ error: "Chapter not found or has no topic_ids" });
    }

    const { resources: topics } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
        parameters: [{ name: "@ids", value: chapter.topic_ids }],
      })
      .fetchAll();

    res.status(200).json(topics);
  } catch (err) {
    console.error("❌ Error fetching topics from chapter:", err);
    res.status(500).json({ error: "Failed to fetch topics for chapter" });
  }
});

// GET : Topic API - Returns full topic documents from Chapter ID

app.get("/api/topic/:topicId", async (req, res) => {
  const { topicId } = req.params;
  try {
    const { resources: topics } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.id = @topicId",
        parameters: [{ name: "@topicId", value: topicId }],
      })
      .fetchAll();
    const topic = topics[0];

    if (!topic || !topic.subtopic_ids || topic.subtopic_ids.length === 0) {
      return res
        .status(404)
        .json({ error: "Topic not found or has no subtopic_ids" });
    }

    const { resources: subtopics } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
        parameters: [{ name: "@ids", value: topic.subtopic_ids }],
      })
      .fetchAll();

    res.status(200).json(subtopics);
  } catch (err) {
    console.error("❌ Error fetching subtopics from topic:", err);
    res.status(500).json({ error: "Failed to fetch subtopics for topic" });
  }
});

//API route that fetches all fields of all elements

app.get("/api/unit-full/:unitId", async (req, res) => {
  const { unitId } = req.params;

  try {
    // 1. Fetch the unit document by ID
    const { resources: units } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.id = @unitId",
        parameters: [{ name: "@unitId", value: unitId }],
      })
      .fetchAll();
    const unit = units[0];

    if (!unit || !Array.isArray(unit.chapter_ids) || unit.chapter_ids.length === 0) {
      return res
        .status(404)
        .json({ error: "Unit not found or has no chapters" });
    }

    // 2. Fetch all chapter documents whose IDs are in unit.chapter_ids
    const { resources: chapters } = await clusterContainer.items
      .query({
        query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
        parameters: [{ name: "@ids", value: unit.chapter_ids }],
      })
      .fetchAll();

    // 3. For each chapter, fetch its topics
    const chaptersWithTopics = await Promise.all(
      chapters.map(async (chapter) => {
        const topicIds = chapter.topic_ids || [];

        const { resources: topics } = await clusterContainer.items
          .query({
            query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
            parameters: [{ name: "@ids", value: topicIds }],
          })
          .fetchAll();

        // 4. For each topic, fetch its subtopics
        const topicsWithSubtopics = await Promise.all(
          topics.map(async (topic) => {
            const subtopicIds = topic.subtopic_ids || [];

            const { resources: subtopics } = await clusterContainer.items
              .query({
                query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
                parameters: [{ name: "@ids", value: subtopicIds }],
              })
              .fetchAll();

            return { ...topic, subtopics };
          })
        );

        return { ...chapter, topics: topicsWithSubtopics };
      })
    );

    // 5. Final response object
    const result = {
      ...unit,
      chapters: chaptersWithTopics,
    };

    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error fetching full unit tree:", err.message);
    res.status(500).json({ error: "Failed to fetch full structure for unit" });
  }
});


//API route that fetches only name fields of all elements

app.get("/api/unit-full-names/:unitId", async (req, res) => {
  const { unitId } = req.params;

  try {
    // 1. Fetch the unit (only name and chapter_ids)
    const { resources: units } = await clusterContainer.items
      .query({
        query: "SELECT c.id, c.name, c.chapter_ids FROM c WHERE c.id = @unitId",
        parameters: [{ name: "@unitId", value: unitId }],
      })
      .fetchAll();

    const unit = units[0];

    if (!unit || !Array.isArray(unit.chapter_ids) || unit.chapter_ids.length === 0) {
      return res.status(404).json({ error: "Unit not found or has no chapters" });
    }

    // 2. Fetch chapters by ID (only name and topic_ids)
    const { resources: chapters } = await clusterContainer.items
      .query({
        query: "SELECT c.id, c.name, c.topic_ids FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
        parameters: [{ name: "@ids", value: unit.chapter_ids }],
      })
      .fetchAll();

    const chaptersWithTopics = await Promise.all(
      chapters.map(async (chapter) => {
        const topicIds = chapter.topic_ids || [];

        // 3. Fetch topics by ID (only name and subtopic_ids)
        const { resources: topics } = await clusterContainer.items
          .query({
            query: "SELECT c.id, c.name, c.subtopic_ids FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
            parameters: [{ name: "@ids", value: topicIds }],
          })
          .fetchAll();

        const topicsWithSubtopics = await Promise.all(
          topics.map(async (topic) => {
            const subtopicIds = topic.subtopic_ids || [];

            // 4. Fetch subtopics (only name)
            const { resources: subtopics } = await clusterContainer.items
              .query({
                query: "SELECT c.name FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
                parameters: [{ name: "@ids", value: subtopicIds }],
              })
              .fetchAll();

            return {
              name: topic.name,
              subtopics: subtopics.map((s) => ({ name: s.name })),
            };
          })
        );

        return {
          name: chapter.name,
          topics: topicsWithSubtopics,
        };
      })
    );

    const result = {
      name: unit.name,
      chapters: chaptersWithTopics,
    };

    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error fetching full names-only structure:", err.message);
    res.status(500).json({ error: "Failed to fetch names-only structure" });
  }
});


// GET: Fetch learning material for a subtopic
app.get("/api/subtopic/:subtopicId", async (req, res) => {
  const { subtopicId } = req.params;

  try {
    const { resources: materials } = await learningMaterialsContainer.items
      .query({
        query: `
          SELECT c.id, c.title, c.url, c.description, c.type, c.questionIds 
          FROM c WHERE c.id = @subtopicId
        `,
        parameters: [{ name: "@subtopicId", value: subtopicId }],
      })
      .fetchAll();

    if (!materials || materials.length === 0) {
      return res.status(404).json({ error: "No learning material found for this subtopic" });
    }

    res.status(200).json(materials[0]);
  } catch (err) {
    console.error("❌ Error fetching learning material:", err);
    res.status(500).json({ error: "Failed to fetch learning material" });
  }
});


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
