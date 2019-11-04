import json
import sys

def writeToFrequencyFile(mostFrequent, frequency_file_name):
    try:
        file = open(frequency_file_name + ".csv", "wb")
        file.write("word,total,".encode("utf-8"))
        for participant in data["participants"]:
            file.write((participant["name"] + ",").encode("utf-8"))
        file.write("\n".encode("utf-8"))

        for mostUsedWord in mostFrequent:
            file.write((mostUsedWord[0] + ",").encode("utf-8"))
            file.write((str(mostUsedWord[1]["total"]) + ",").encode("utf-8"))
            for participant in data["participants"]:
                if (participant["name"] in mostUsedWord[1]):
                    file.write((str(mostUsedWord[1][participant["name"]]) + ",").encode("utf-8"))
            file.write("\n".encode("utf-8"))
        
        file.close()
    except:
        print("An error occured while opening or writing to file: " + frequency_file_name)

def writeToSenderFrequencyFile(senders, sender_file_name):
    try:
        file2 = open(sender_file_name + ".csv", "wb")
        for sender in list(senders.items()):
            file2.write((sender[0] + "," + str(sender[1]) + "\n").encode("utf-8"))
        
        file2.close()
    except: 
        print("An error occured while opening or writing to file: " + sender_file_name)

def writeToFiles(mostFrequent, senders, frequency_file_name, sender_file_name):
    writeToFrequencyFile(mostFrequent, frequency_file_name)
    writeToSenderFrequencyFile(senders, sender_file_name)

    """
    keys = map(lambda mostUsed: mostUsed[0], mostUsed)
    values = map(lambda mostUsed: mostUsed[1], mostUsed)

    model = {"keys": list(keys), "values": list(values)}
    
    df = pd.Dataframe(model)
    ax = df.plot.bar(x = "keys", y = "values", rot = 0)
    """

def populateFrequencyDicts(data, mostFrequent, senders):
    for message in data["messages"]:
        sender = message.get("sender_name", "")
        if (sender in senders):
            senders[sender] = senders[sender] + 1
        else:
            senders[sender] = 1
        decoded = message.get("content", "")
        contents = decoded.split()
        for word in contents:
            word = word.lower()
            if (word in mostFrequent):
                mostFrequent[word]["total"] = mostFrequent[word]["total"] + 1
                if (message["sender_name"] in mostFrequent[word]):
                    mostFrequent[word][message["sender_name"]] = mostFrequent[word][message["sender_name"]] + 1
                else:
                    mostFrequent[word][message["sender_name"]] = 1
            else:
                mostFrequent[word] = {"total": 1, message["sender_name"]: 1}

def getMostUsed(mostFrequent, start, end):
    wordFrequencyList = list(mostFrequent.items())
    wordFrequencyList.sort(key = lambda mostFrequent: mostFrequent[1]["total"], reverse = True)
    return wordFrequencyList[int(start):int(end)]

def processFiles(data, start, end, frequency_file_name, sender_file_name):
    mostFrequent = {}
    senders = {}

    try: 
        populateFrequencyDicts(data, mostFrequent, senders)
        mostUsed = getMostUsed(mostFrequent, start, end)
        writeToFiles(mostUsed, senders, frequency_file_name, sender_file_name)
    except Exception as e: 
        print("An error occured while extracting data from the file, make sure you are using the right file provided by facebook in json format")
        print(str(e))
        
if (len(sys.argv) == 4 or len(sys.argv) == 6): 
    start = 0
    end = 1000
    if (len(sys.argv) == 6):
        start = sys.argv[4]
        end = sys.argv[5]
    try:
        file = open(sys.argv[1])
        data = json.load(file)
        file.close()
        processFiles(data, start, end, sys.argv[2], sys.argv[3])
    except:
        print("Something went wrong while opening " + sys.argv[1])
else:
    print("Invalid argument list. Script should be called with py visualize.py [input_file] [frequency_file_name] [sender_file_name] OPTIONAL[start] OPTIONAL[end]")