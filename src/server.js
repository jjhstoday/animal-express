import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import cors from 'cors';
import bodyParser from 'body-parser';
import bcrypt, { compareSync } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import myPassport from './passport';
import User from './model/user';
import Pet from './model/pet';
import Like from './model/like';
import Comment from './model/comment';

dotenv.config();
const app = express();
const PORT = process.env.PORT;

// db
mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('DB connected successfully');
}).catch((err) => {
    console.log(err);
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());
myPassport(passport);

app.post('/signup', async (req, res) => {
    const { email, password, username } = req.body;

    try {
        const user = await User.findOne({ email });
        if(user) {
            throw new Error('Existed user')
        }
        
        const newUser = new User({
            email,
            username,
            password
        });
        const salt = await bcrypt.genSalt(5);
        const hashed = await bcrypt.hash(password, salt);
        newUser.password = hashed;
        await newUser.save();

        const payload = {
            id: newUser._id,
            name: newUser.username
        }
        const token = await jwt.sign(payload, process.env.SECRET, { expiresIn: 3600 * 24 });
        // req.cookies.set('access_token', token, { httpOnly: true, maxAge: 3600 * 24 });

        res.json({
            ok: true,
            user: newUser,
            token: token,
        })
    } catch(err) {
        console.log(err);
        return res.status(400).json({
            ok: false,
            error: err.message
        })
    }

});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        console.log(user);
        if(!user) {
            throw new Error('Not sign up yet');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch) {
            throw new Error('Password is not matched');
        }

        const payload = {
            id: user._id,
            name: user.name
        }
        const token = await jwt.sign(payload, process.env.SECRET, { expiresIn: 3600 * 24 });
        // req.cookies.set('access_token', token, { httpOnly: true, maxAge: 3600 * 24 });

        res.json({
            ok: true,
            payload: user,
            username: user.name,
            token: 'Bearer ' + token
        })
    } catch(err) {
        console.log(err);
        res.status(400).json({
            ok: false,
            error: err.message
        })
    };
});

app.get('/logout', (req, res) => {
    req.logout();
    res.json({
        ok: true,
        message: 'logout'
    })
});

// app.put('/favorites', passport.authenticate('jwt', { session: false }), (req, res) => {

// });

// app.post('/like', passport.authenticate('jwt', { session: false }), (req, res) => {
//     const { like } = req.body;
//     Like.findOne({ user }).then(async like => {
//         try {
//             const newLike = new Like({
//                 like: true
//             });

//             await newLike.save();
//             res.json({
//                 ok: true,
//             })
//         } catch(err) {
//             console.log(err);
//             res.status(400).json({
//                 ok: false,
//                 error: err.message
//             })
//         }
//     })
// });

// app.delete('/like', passport.authenticate('jwt', { session: false }), (req, res) => {

// });

app.post('/comment', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const { comment, petId, userId } = req.body;
    try {
        const newComment = new Comment({
            comment,
            pet: petId,
            owner: userId
        })
        newComment.save();

        const pet = await Pet.findById(petId);
        await pet.updateOne({comments: [...pet.comments, newComment._id]})
        res.json(await Comment.findOne({_id: newComment._id})).populate('owner');

    } catch (error) {
        console.log(error);
        res.status(400).json({
            ok: false,
            error: error.message
        })
    }
})

app.post('/pets', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const { name, deathDate, favorites, image, userId } = req.body;

    try {
        const pet = await Pet.findOne({ name });

        if(pet) {
            throw new Error('Your pet is already register');
        }

        const newPet = new Pet({
            name,
            deathDate,
            favorites,
            image,
            owner: userId
        })

        await newPet.save();
        res.json({
            ok: true,
            pet: newPet
        })
    } catch (error) {
        console.log(error);
        res.status(400).json({
            ok: false,
            error: error.message
        })
    }
});

app.get('/pets', passport.authenticate('jwt', { session: false }), async (req, res) => {
    if(req.body.petId) {
        try {
            const pet = await Pet.findOne({ _id: req.body.petId }).populate('owner').populate({path:'comments', populate: {path:'owner'}});
            res.json({pet});
        } catch (error) {
            console.log(error);
            res.status(400).json({
                ok: false,
                error: error.message
            })
        }
    } else {
        try {
            const pets = await Pet.find({}).populate('owner').populate({path:'comments', populate: {path:'owner'}});
            if (!pets.length) return res.status(404).send({ err: 'No animal exists' });
            res.json({pets});
        } catch (error) {
            console.log(error);
            res.status(400).json({
                ok: false,
                error: error.message
            })
        }

    }
});

app.listen(PORT, () => {
    console.log(`Server is started on ${PORT}`);
});