//imports
require('dotenv').config();

const fs = require('fs');
const upload  = require('multer')();

const express = require('express');
const app = express();

const { v4: uuidv4 } = require('uuid');

const mongodb = require('mongodb');

//server setup config
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = process.env.ENV === 'DEV' ? process.env.DEV_PORT : process.env.PROD_PORT;

//server setup
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

//mongodb connection setup
const uri = "mongodb://localhost:27017";
const client = new mongodb.MongoClient(uri);

//get event/s based on query parameters
const getEvent = async (queryParameter) => {

        //setup collection object and bucket
        await client.connect();
        const db = client.db('internship-test');
        const events = db.collection('events');
        const bucket = new mongodb.GridFSBucket(db, { bucketName: 'myImagesBucket' });
        //discern query parameter/s and query accordingly
        const {
            id,
            limit
        } = queryParameter;
        const data = Object.keys(queryParameter)[0] === 'id' ? await events.findOne({
            uid: id
        }) : await events.find().sort({
            $natural: 1
        }).limit(limit).toArray();
        //if only a single event is requested, fetch corresponding file from bucket
        id?bucket.openDownloadStreamByName(data.files.originalname).pipe(fs.createWriteStream(`./outputFile.${data.files.mimetype.split('/')[1]}`)):null;
        //return data
        data.files=data.files.originalname;
        return (data);

}
//post event to database
const postEvent = async (event) => {

        //setup collection object and bucket
        await client.connect();
        const db = client.db('internship-test');
        const events = client.db('internship-test').collection('events');
        const bucket = new mongodb.GridFSBucket(db, { bucketName: 'myImagesBucket' });
        //upload to bucket
        fs.createReadStream(event.files).pipe(bucket.openUploadStream(event.files));
        //add to db
        events.insertOne(event);
        //return uid
        return(event.uid);

}
//put event to database
const putEvent = async (event) => {

    //setup collection object and bucket
    await client.connect();
    const db = client.db('internship-test');
    const events = db.collection('events');
    const bucket = new mongodb.GridFSBucket(db, { bucketName: 'myImagesBucket' });
    //upload to bucket
    fs.createReadStream(`./files/${event.files.originalname}`).pipe(bucket.openUploadStream(event.files.originalname));
    //upsert to db
    const { uid } = event;
    const updateDoc = { $set: { ...event } };
    const filter = { uid: uid };
    const options = { upsert: true };
    await events.updateOne(filter, updateDoc, options);
    //return statement
    return ('Document put successfully!');

}
//delete event from database
const deleteEvent = async (id) => {

    //setup collection object
    await client.connect();
    const db = client.db('internship-test')
    const events = db.collection('events');
    const bucket = new mongodb.GridFSBucket(db, { bucketName: 'myImagesBucket' });
    //delete from bucket after getting _id from db of corresponding document
    const filename = await events.find({ uid: id }).project({files:1}).toArray()[0].files.originalname;
    // const idReference = await bucket.find({name:filename});
    console.log(filename);
    // bucket.delete(filename);
    //delete from db
    // await events.deleteOne({ uid: id });
    //return statement
    return ('Deleted event successfully!');

}

//without params
app.route(`/api/v3/app/events`)
    .get(({
        query: {
            id,
            type,
            limit,
            page
        }
    }, res) => {
        const queryParameter = id ? {
            id: id
        } : {
            type: type,
            page: parseInt(page),
            limit: parseInt(limit)
        };
        getEvent(queryParameter).then((res) => {
            console.log({files : res.files.originalname, ...res});
        })
    })
    .post(upload.any(), ({body, files}, res) => {
        postEvent({ uid : uuidv4(), ...body, files: files[0] }).then((res) => {
            console.log(res);
        })
    })

//with params
app.route(`/api/v3/app/events/:id`)
    .put(upload.any(), ({
        params: {
            id
        },
        body,
        files
    }, res) => {
        putEvent({ uid : id, ...body, files: files[0] }).then((res) => {
            console.log(res);
        })
    })
    .delete(({
        params: {
            id
        }
    }, res) => {
        deleteEvent(id).then((res) => {
            console.log(res);
        })
    })
    