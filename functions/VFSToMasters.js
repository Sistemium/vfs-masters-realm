exports = async function(changeEvent) {
  const toTransfer = context.values.get("SourceCollectionMap");
  
  const SOURCE_DB = 'test_vfs';
  const TARGET_DB = 'test_masters';
  const EXCLUDED_FIELDS = ['id', 'ts', 'cts', 'deviceUUID', 'deviceCts'];
  
  const mongodb = context.services.get('mongodb-atlas');
  const sourceDatabase = mongodb.db(SOURCE_DB);
  const operationType = changeEvent.operationType;
  const sourceCollection = changeEvent.ns.coll;
  
  const ALLOWED_COLLECTIONS = toTransfer.map(entry => entry.coll);
  
  if (!ALLOWED_COLLECTIONS.includes(sourceCollection)) {
    console.log(`Ignored operation on collection: ${sourceCollection}`);
    return;
  }
  
  let targetDatabase = mongodb.db(TARGET_DB);
  let targetCollection = targetDatabase.collection(sourceCollection);
  
  let toTransferObject = toTransfer.find(entry => entry.coll === sourceCollection);
  
  if (operationType === 'insert' || operationType === 'update') {
    let document = (operationType === 'insert') ? changeEvent.fullDocument : changeEvent.updateDescription.updatedFields;
    EXCLUDED_FIELDS.forEach(field => delete document[field]);
    
    let documentWithRelations = await addRelations(sourceDatabase, sourceCollection, toTransferObject, document);
    
    if (operationType === 'insert') {
      const query = { _id: document._id };
      const existingDocument = await targetCollection.findOne(query);
      if (existingDocument) {
        console.log(`Document with _id ${document._id} already exists. Skipping insert.`);
        return;
      }
      await targetCollection.insertOne(documentWithRelations);
      console.log(`Document inserted in ${TARGET_DB} database: ${documentWithRelations._id}`);
    } else if (operationType === 'update') {
      await targetCollection.updateOne(
        { _id: changeEvent.documentKey._id },
        { $set: documentWithRelations }
      );
      console.log(`Document updated in ${TARGET_DB} database: ${changeEvent.documentKey._id}`);
    }
  } else if (operationType === 'delete') {
      const docId = changeEvent.documentKey._id;
      await targetCollection.deleteOne({ _id: docId });
      console.log(`Document deleted in ${TARGET_DB} database: ${docId}`);
    }
};

async function addRelations(mongoService, collectionName, toTransferObject, document) {
  if (toTransferObject.rels && toTransferObject.rels.length > 0) {
    for (let rel of toTransferObject.rels) {
      if (document.hasOwnProperty(rel.field)) {
        const fromCollection = mongoService.collection(rel.from);
        const relatedDocument = await fromCollection.findOne({ _id: document[rel.field] });
        if (relatedDocument) {
          document[rel.from.toLowerCase()] = relatedDocument._id;
        }
      }
    }
  }
  return document;
}